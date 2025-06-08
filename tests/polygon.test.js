const request = require('supertest');
const { createApp } = require('../server');

function mockPool(returnRows) {
  return {
    query: jest.fn().mockResolvedValue({ rows: returnRows })
  };
}

describe('POST /check-location', () => {
  test('returns inside true when point is inside a polygon', async () => {
    const pool = mockPool([{ id: 1 }]);
    const app = createApp(pool);
    const res = await request(app)
      .post('/check-location')
      .send({ lat: 10, lon: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inside: true, polygonId: 1 });
  });

  test('returns inside false when point is outside polygons', async () => {
    const pool = mockPool([]);
    const app = createApp(pool);
    const res = await request(app)
      .post('/check-location')
      .send({ lat: 10, lon: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inside: false });
  });
});

describe('POST /polygons', () => {
  test('inserts polygon and returns id', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 5 }] })
    };
    const app = createApp(pool);
    const res = await request(app)
      .post('/polygons')
      .send({ name: 'test', coordinates: [[0,0],[1,0],[1,1]] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 5 });
    expect(pool.query).toHaveBeenCalled();
  });

  test('returns 400 for missing name', async () => {
    const pool = mockPool([]);
    const app = createApp(pool);
    const res = await request(app)
      .post('/polygons')
      .send({ coordinates: [[0,0],[1,0],[1,1]] });
    expect(res.status).toBe(400);
  });

  test('returns 400 for too few coordinates', async () => {
    const pool = mockPool([]);
    const app = createApp(pool);
    const res = await request(app)
      .post('/polygons')
      .send({ name: 'bad', coordinates: [[0,0],[1,0]] });
    expect(res.status).toBe(400);
  });
});

describe('runMigrations', () => {
  test('creates table and inserts default circle', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const app = createApp(pool);
    await app.runMigrations();
    expect(pool.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS polygon_areas'));
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO polygon_areas'), expect.any(Array));
  });
});
