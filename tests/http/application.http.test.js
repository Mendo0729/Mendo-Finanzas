import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import express from 'express';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { errorHandler } from '../../src/core/middleware/error-handler.js';
import { requestContext } from '../../src/core/middleware/request-context.js';
import { asyncHandler } from '../../src/core/utils/async-handler.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  await prisma.$disconnect();
});

test('GET / devuelve la página inicial y encabezados de seguridad', async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();
  const contentSecurityPolicy = response.headers.get('content-security-policy') ?? '';

  assert.equal(response.status, 200);
  assert.match(body, /SharedWallet/);
  assert.match(response.headers.get('x-request-id'), /^[A-Za-z0-9._-]{8,100}$/);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(contentSecurityPolicy, /script-src 'self'/);
  assert.doesNotMatch(contentSecurityPolicy, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
});

test('GET /health devuelve el estado de aplicación y base de datos', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { accept: 'application/json' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'up');
  assert.ok(body.timestamp);
});

test('una ruta inexistente devuelve 404 sin exponer detalles internos ni parámetros', async () => {
  const response = await fetch(`${baseUrl}/ruta-inexistente?token=secreto-no-visible`);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(body, /Página no encontrada/);
  assert.match(body, /\/ruta-inexistente/);
  assert.doesNotMatch(body, /secreto-no-visible/);
  assert.doesNotMatch(body, /PrismaClient/);
});

test('los errores asíncronos llegan al manejador central y devuelven JSON seguro', async () => {
  const testApp = express();
  testApp.use(requestContext);
  testApp.get(
    '/boom',
    asyncHandler(async () => {
      throw new Error('detalle interno de prueba');
    }),
  );
  testApp.use(errorHandler);

  const testServer = await new Promise((resolve) => {
    const listeningServer = testApp.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  const address = testServer.address();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/boom`, {
      headers: { accept: 'application/json' },
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.equal(body.error.message, 'Ocurrió un error interno.');
    assert.ok(body.error.requestId);
    assert.doesNotMatch(JSON.stringify(body), /detalle interno de prueba/);
  } finally {
    await new Promise((resolve, reject) => {
      testServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
