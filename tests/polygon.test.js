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
