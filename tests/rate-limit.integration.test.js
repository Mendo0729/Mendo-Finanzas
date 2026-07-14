import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import {
  PostgresRateLimitStore,
  hashRateLimitKey,
} from '../src/core/security/postgres-rate-limit-store.js';

const TEST_SCOPE_PREFIX = 'test.rate-limit.';

function testScope(label) {
  return `${TEST_SCOPE_PREFIX}${label}.${randomUUID()}`;
}

after(async () => {
  await prisma.rateLimitBucket.deleteMany({
    where: { scope: { startsWith: TEST_SCOPE_PREFIX } },
  });
  await prisma.$disconnect();
});

test('dos instancias comparten el mismo contador y la clave queda hasheada', async () => {
  const scope = testScope('shared');
  const key = '127.0.0.1:usuario@example.com';
  const firstStore = new PostgresRateLimitStore({ scope });
  const secondStore = new PostgresRateLimitStore({ scope });

  const first = await firstStore.consume(key, 60_000);
  const second = await secondStore.consume(key, 60_000);

  assert.equal(first.count, 1);
  assert.equal(second.count, 2);

  const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({
    where: {
      scope_keyHash: {
        scope,
        keyHash: hashRateLimitKey(key),
      },
    },
  });

  assert.equal(bucket.attempts, 2);
  assert.equal(bucket.keyHash.length, 64);
  assert.notEqual(bucket.keyHash, key);
});

test('incrementa concurrentemente sin perder intentos', async () => {
  const scope = testScope('concurrent');
  const key = '203.0.113.10';
  const stores = Array.from(
    { length: 12 },
    () => new PostgresRateLimitStore({ scope, cleanupInterval: 10_000 }),
  );

  await Promise.all(stores.map((store) => store.consume(key, 60_000)));

  const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({
    where: {
      scope_keyHash: {
        scope,
        keyHash: hashRateLimitKey(key),
      },
    },
  });

  assert.equal(bucket.attempts, 12);
});

test('reinicia el contador cuando la ventana ya venció', async () => {
  const scope = testScope('expired-window');
  const key = '198.51.100.20';
  const store = new PostgresRateLimitStore({ scope });

  await store.consume(key, 60_000);
  await prisma.rateLimitBucket.update({
    where: {
      scope_keyHash: {
        scope,
        keyHash: hashRateLimitKey(key),
      },
    },
    data: { attempts: 5, resetAt: new Date(Date.now() - 1_000) },
  });

  const renewed = await store.consume(key, 60_000);

  assert.equal(renewed.count, 1);
  assert.ok(renewed.resetAt > Date.now());
});

test('elimina buckets vencidos durante la limpieza oportunista', async () => {
  const expiredScope = testScope('cleanup-expired');
  const activeScope = testScope('cleanup-active');

  await prisma.rateLimitBucket.create({
    data: {
      scope: expiredScope,
      keyHash: 'a'.repeat(64),
      attempts: 3,
      resetAt: new Date(Date.now() - 60_000),
    },
  });

  const store = new PostgresRateLimitStore({
    scope: activeScope,
    cleanupInterval: 1,
  });
  await store.consume('192.0.2.30', 60_000);

  assert.equal(
    await prisma.rateLimitBucket.count({
      where: { scope: expiredScope },
    }),
    0,
  );
});
