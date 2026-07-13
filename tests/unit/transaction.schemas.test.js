import assert from 'node:assert/strict';
import test from 'node:test';

import {
  transactionBodySchema,
  transactionIdSchema,
  transactionQuerySchema,
} from '../../src/modules/transactions/transaction.schemas.js';

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
  const parsed = transactionBodySchema.parse({
    ...validBody(),
    householdId: '999',
  });

  assert.equal(parsed.transactionType, 2);
  assert.equal(parsed.accountId, 10n);
  assert.equal(parsed.categoryId, 20n);
  assert.equal(parsed.amount, '125.50');
  assert.equal(parsed.transactionDate.toISOString(), '2026-07-13T00:00:00.000Z');
  assert.equal('householdId' in parsed, false);
});

test('normaliza un identificador de movimiento válido', () => {
  assert.deepEqual(transactionIdSchema.parse({ transactionId: '42' }), {
    transactionId: 42n,
  });
});

test('rechaza identificadores de movimiento inválidos', () => {
  assert.throws(
    () => transactionIdSchema.parse({ transactionId: 'otro-espacio' }),
    (error) => error.issues?.[0]?.path?.[0] === 'transactionId',
  );
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

test('normaliza búsqueda, filtros, página y orden', () => {
  const parsed = transactionQuerySchema.parse({
    search: '  supermercado  ',
    fromDate: '2026-07-01',
    toDate: '2026-07-31',
    accountId: '10',
    categoryId: '20',
    transactionType: '2',
    minAmount: '10.5',
    maxAmount: '250.00',
    page: '3',
    sort: 'amount_desc',
  });

  assert.equal(parsed.search, 'supermercado');
  assert.equal(parsed.fromDate.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(parsed.toDate.toISOString(), '2026-07-31T00:00:00.000Z');
  assert.equal(parsed.accountId, 10n);
  assert.equal(parsed.categoryId, 20n);
  assert.equal(parsed.transactionType, 2);
  assert.equal(parsed.minAmount, '10.5');
  assert.equal(parsed.maxAmount, '250.00');
  assert.equal(parsed.page, 3);
  assert.equal(parsed.sort, 'amount_desc');
});

test('aplica valores predeterminados a una consulta vacía', () => {
  const parsed = transactionQuerySchema.parse({});

  assert.equal(parsed.page, 1);
  assert.equal(parsed.sort, 'date_desc');
  assert.equal(parsed.search, null);
  assert.equal(parsed.accountId, null);
});

test('rechaza rangos de fecha y monto invertidos', () => {
  assert.throws(
    () =>
      transactionQuerySchema.parse({
        fromDate: '2026-07-31',
        toDate: '2026-07-01',
      }),
    (error) => error.issues?.[0]?.path?.[0] === 'toDate',
  );
  assert.throws(
    () => transactionQuerySchema.parse({ minAmount: '10.01', maxAmount: '10.00' }),
    (error) => error.issues?.[0]?.path?.[0] === 'maxAmount',
  );
});

test('rechaza páginas y órdenes inválidos', () => {
  assert.throws(
    () => transactionQuerySchema.parse({ page: '0' }),
    (error) => error.issues?.[0]?.path?.[0] === 'page',
  );
  assert.throws(
    () => transactionQuerySchema.parse({ sort: 'created_by' }),
    (error) => error.issues?.[0]?.path?.[0] === 'sort',
  );
});
