import assert from 'node:assert/strict';
import test from 'node:test';

import { transactionBodySchema } from '../../src/modules/transactions/transaction.schemas.js';

function validBody(overrides = {}) {
  return {
    transactionType: '2',
    accountId: '10',
    categoryId: '20',
    description: 'Compra semanal',
    amount: '125.50',
    transactionDate: '2026-07-13',
    notes: 'Supermercado',
    ...overrides,
  };
}

test('normaliza una transacción válida sin aceptar householdId del navegador', () => {
  const parsed = transactionBodySchema.parse({ ...validBody(), householdId: '999' });

  assert.equal(parsed.transactionType, 2);
  assert.equal(parsed.accountId, 10n);
  assert.equal(parsed.categoryId, 20n);
  assert.equal(parsed.amount, '125.50');
  assert.equal(parsed.transactionDate.toISOString(), '2026-07-13T00:00:00.000Z');
  assert.equal('householdId' in parsed, false);
});

test('rechaza montos iguales a cero', () => {
  assert.throws(
    () => transactionBodySchema.parse(validBody({ amount: '0' })),
    (error) => error.issues?.[0]?.path?.[0] === 'amount',
  );
});

test('rechaza fechas inexistentes', () => {
  assert.throws(
    () => transactionBodySchema.parse(validBody({ transactionDate: '2026-02-30' })),
    (error) => error.issues?.[0]?.path?.[0] === 'transactionDate',
  );
});

test('rechaza tipos reservados para transferencias', () => {
  assert.throws(
    () => transactionBodySchema.parse(validBody({ transactionType: '3' })),
    (error) => error.issues?.[0]?.path?.[0] === 'transactionType',
  );
});
