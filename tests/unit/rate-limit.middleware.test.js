import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryRateLimitStore, createRateLimiter } from '../../src/core/middleware/rate-limit.js';

function runMiddleware(middleware, request = { ip: '127.0.0.1' }) {
  const headers = new Map();
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

test('elimina entradas vencidas y limita el tamaño del almacenamiento', () => {
  let now = 1_000;
  const store = new MemoryRateLimitStore({
    now: () => now,
    maxEntries: 2,
    cleanupInterval: 1,
  });

  store.consume('primera', 60_000);
  now += 60_001;
  store.consume('segunda', 60_000);

  assert.equal(store.entries.has('primera'), false);
  assert.equal(store.entries.size, 1);

  store.consume('tercera', 60_000);
  store.consume('cuarta', 60_000);

  assert.equal(store.entries.size, 2);
  assert.equal(store.entries.has('segunda'), false);
  assert.equal(store.entries.has('tercera'), true);
  assert.equal(store.entries.has('cuarta'), true);
});

test('acota claves generadas por datos enviados por el cliente', async () => {
  const store = new MemoryRateLimitStore();
  const limiter = createRateLimiter({
    windowMs: 60_000,
    limit: 2,
    store,
    keyGenerator: () => 'x'.repeat(5_000),
  });

  await runMiddleware(limiter);

  const [storedKey] = store.entries.keys();
  assert.equal(storedKey.length, 512);
});
