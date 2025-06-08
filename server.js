require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

function createApp(pool, connectionString) {
  connectionString = connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gis_database';
  pool = pool || new Pool({ connectionString });
  const app = express();
  app.use(express.json());

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Polygon API',
        version: '1.0.0'
      }
    },
    apis: [__filename]
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  async function ensureDatabaseExists(connectionString, retries = 5, delayMs = 2000) {
    const url = new URL(connectionString);
    const dbName = url.pathname.slice(1);
    const adminUrl = `${url.protocol}//${url.username}:${url.password}@${url.hostname}:${url.port}/postgres`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const adminPool = new Pool({ connectionString: adminUrl });
      try {
        const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (result.rowCount === 0) {
          await adminPool.query(`CREATE DATABASE "${dbName}"`);
          console.log(`Database ${dbName} created`);
        }
        await adminPool.end();
        return;
      } catch (err) {
        await adminPool.end();
        if (err.code === 'ECONNREFUSED' && attempt < retries) {
          console.warn(`Database connection refused, retrying (${attempt}/${retries})...`);
          await new Promise(res => setTimeout(res, delayMs));
          continue;
        }
        console.error('Database check failed:', err);
        throw err;
      }
    }
  }

  async function runMigrations() {
    const path = require('path');
    const createSql = fs.readFileSync(path.join(__dirname, 'sql', 'create_polygon_areas.sql'), 'utf8');
    const insertSql = `INSERT INTO polygon_areas(name, geom)
      VALUES (
        $1,
        ST_Buffer(
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          1000
        )::geometry
      )`;

    const defaultLat = parseFloat(process.env.CIRCLE_LAT || '40.0');
    const defaultLon = parseFloat(process.env.CIRCLE_LON || '-74.0');
    const defaultName = process.env.CIRCLE_NAME || 'Home area';

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
      await pool.query(createSql);
      await pool.query(insertSql, [defaultName, defaultLon, defaultLat]);
      console.log('Database migrations applied');
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }
  }

  async function checkPoint(lat, lon) {
    const query = `SELECT id FROM polygon_areas
      WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      LIMIT 1`;
    const { rows } = await pool.query(query, [lon, lat]);
    if (rows.length > 0) {
      return { inside: true, polygonId: rows[0].id };
    }
    return { inside: false };
  }

  /**
   * @openapi
   * /polygons:
   *   post:
   *     summary: Add a new polygon area
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               coordinates:
   *                 type: array
   *                 items:
   *                   type: array
   *                   items:
   *                     type: number
   *     responses:
   *       201:
   *         description: Polygon created
   */
  app.post('/polygons', async (req, res) => {
    const { name, coordinates } = req.body;
    if (typeof name !== 'string' || !Array.isArray(coordinates) || coordinates.length < 3) {
      return res.status(400).json({ error: 'name and coordinates required' });
    }
    if (!coordinates.every(c => Array.isArray(c) && c.length === 2 &&
      typeof c[0] === 'number' && typeof c[1] === 'number')) {
      return res.status(400).json({ error: 'invalid coordinate format' });
    }
    const ring = coordinates.slice();
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first);
    }
    const coordsText = ring.map(c => `${c[0]} ${c[1]}`).join(', ');
    const polygonWKT = `POLYGON((${coordsText}))`;
    try {
      const result = await pool.query(
        'INSERT INTO polygon_areas (name, geom) VALUES ($1, ST_GeomFromText($2, 4326)) RETURNING id',
        [name, polygonWKT]
      );
      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  });

  /**
   * @openapi
   * /check-location:
   *   post:
   *     summary: Check if a point is inside a polygon
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               lat:
   *                 type: number
   *               lon:
   *                 type: number
   *     responses:
   *       200:
   *         description: Result of the check
   */
  app.post('/check-location', async (req, res) => {
    const { lat, lon } = req.body;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    try {
      const result = await checkPoint(lat, lon);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  });

  app.checkPoint = checkPoint;
  app.runMigrations = runMigrations;
  app.ensureDatabaseExists = (connString) => ensureDatabaseExists(connString || connectionString);
  return app;
}

if (require.main === module) {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/gis_database';
  const pool = new Pool({ connectionString });
  const app = createApp(pool, connectionString);
  const port = process.env.PORT || 3000;
  app.ensureDatabaseExists()
    .then(() => app.runMigrations())
    .then(() => {
      app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
        console.log(`API docs available at http://localhost:${port}/api-docs`);
      });
    })
    .catch(err => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = { createApp };
