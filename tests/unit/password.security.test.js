import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../../src/core/security/password.js';

test('genera hashes Argon2id y valida la contraseña correcta', async () => {
  const password = 'Una frase de contraseña segura 2026';
  const passwordHash = await hashPassword(password);

  assert.match(passwordHash, /^\$argon2id\$/);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(passwordHash, password), true);
  assert.equal(await verifyPassword(passwordHash, 'contraseña incorrecta'), false);
});

test('un hash inválido se rechaza sin exponer una excepción', async () => {
  assert.equal(await verifyPassword('hash-invalido', 'cualquier contraseña'), false);
});
