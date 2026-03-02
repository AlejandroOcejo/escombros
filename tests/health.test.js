const request = require('supertest');
const { createApp } = require('../src/app');

describe('GET /health', () => {
  test('responde 200 y status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
