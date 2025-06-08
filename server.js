const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

function createApp(pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres'
})) {
  const app = express();
  app.use(bodyParser.json());

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
  });
}

module.exports = { createApp };
