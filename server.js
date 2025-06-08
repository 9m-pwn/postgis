const express = require('express');
const { Pool } = require('pg');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

function createApp(pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres'
})) {
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
  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`API docs available at http://localhost:${port}/api-docs`);
  });
}

module.exports = { createApp };
