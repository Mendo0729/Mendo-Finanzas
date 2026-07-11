import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PrismaSessionStore } from '../../src/config/session.js';

test('touch renueva únicamente la expiración y no sobrescribe el contenido de la sesión', async () => {
  let updateArguments;
  const client = {
    session: {
      updateMany(argumentsValue) {
        updateArguments = argumentsValue;
        return Promise.resolve({ count: 1 });
      },
    },
  };
  const store = new PrismaSessionStore({ client });
  const expires = new Date('2030-01-01T00:00:00.000Z');

  await new Promise((resolve, reject) => {
    store.touch(
      'session-id',
      {
        cookie: { expires },
        userId: '42',
        householdId: '7',
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });

  assert.deepEqual(updateArguments.where, { sid: 'session-id' });
  assert.equal(updateArguments.data.expire.toISOString(), expires.toISOString());
  assert.equal(Object.hasOwn(updateArguments.data, 'sess'), false);
});
