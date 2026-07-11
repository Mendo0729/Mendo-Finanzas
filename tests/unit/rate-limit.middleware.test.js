import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryRateLimitStore, createRateLimiter } from '../../src/core/middleware/rate-limit.js';

function runMiddleware(middleware) {
  const headers = new Map();
  const request = { ip: '127.0.0.1' };
  const response = {
    setHeader(name, value) {
      headers.set(name, value);
    },
  };

  return new Promise((resolve) => {
    middleware(request, response, (error) => resolve({ error, headers }));
  });
}

test('permite solicitudes dentro del límite y rechaza la siguiente', async () => {
  let now = 1_000;
  const store = new MemoryRateLimitStore({ now: () => now });
  const limiter = createRateLimiter({ windowMs: 60_000, limit: 2, store });

  assert.equal((await runMiddleware(limiter)).error, undefined);
  assert.equal((await runMiddleware(limiter)).error, undefined);

  const rejected = await runMiddleware(limiter);
  assert.equal(rejected.error.code, 'RATE_LIMITED');
  assert.equal(rejected.error.statusCode, 429);
  assert.equal(rejected.headers.get('RateLimit-Remaining'), '0');
  assert.ok(rejected.headers.get('Retry-After'));

  now += 60_001;
  assert.equal((await runMiddleware(limiter)).error, undefined);
});
