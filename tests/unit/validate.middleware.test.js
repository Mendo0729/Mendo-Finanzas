import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ValidationError } from '../../src/core/errors/app-error.js';
import { validate } from '../../src/core/middleware/validate.js';

test('validate guarda body, params y query transformados en request.validated', () => {
  const request = {
    body: { amount: '25.50' },
    params: { transactionId: '10' },
    query: { page: '2' },
  };
  let nextError;

  validate({
    body: (body) => ({ ...body, amount: Number(body.amount) }),
    params: {
      parse(params) {
        return { transactionId: BigInt(params.transactionId) };
      },
    },
    query: (query) => ({ page: Number(query.page) }),
  })(request, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError, undefined);
  assert.deepEqual(request.validated.body, { amount: 25.5 });
  assert.deepEqual(request.validated.params, { transactionId: 10n });
  assert.deepEqual(request.validated.query, { page: 2 });
});

test('validate convierte errores de esquema en ValidationError', () => {
  const request = { body: {}, params: {}, query: {} };
  let nextError;

  validate({
    body: {
      parse() {
        const error = new Error('invalid');
        error.issues = [{ path: ['amount'], message: 'Debe ser mayor que cero.' }];
        throw error;
      },
    },
  })(request, {}, (error) => {
    nextError = error;
  });

  assert.ok(nextError instanceof ValidationError);
  assert.equal(nextError.statusCode, 400);
  assert.deepEqual(nextError.details, [
    {
      path: 'amount',
      message: 'Debe ser mayor que cero.',
    },
  ]);
});
