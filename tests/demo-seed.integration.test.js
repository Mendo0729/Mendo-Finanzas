import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { PrismaClient } from '@prisma/client';

import { verifyPassword } from '../src/core/security/password.js';

const prisma = new PrismaClient();
const DEMO_EMAIL = 'demo@mendofinanzas.local';
const DEMO_PASSWORD = 'MendoFinanzasDemo2026!';

after(async () => {
  await prisma.$disconnect();
});

test('el usuario del seed tiene una contraseña Argon2id válida para pruebas locales', async () => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_EMAIL },
  });

  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(user.passwordHash, DEMO_PASSWORD), true);
});
