import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import {
  BUDGET_PROGRESS_STATES,
  getBudgetProgressState,
} from '../../src/modules/budgets/budget.constants.js';
import {
  budgetBodySchema,
  budgetIdSchema,
  budgetQuerySchema,
  budgetStatusSchema,
} from '../../src/modules/budgets/budget.schemas.js';

test('normaliza un presupuesto mensual válido sin aceptar householdId', () => {
  const parsed = budgetBodySchema.parse({
    householdId: '999',
    categoryId: '25',
    month: '2026-07',
    amount: '450.75',
  });

  assert.deepEqual(parsed, {
    categoryId: 25n,
    monthStart: new Date('2026-07-01T00:00:00.000Z'),
    amount: '450.75',
  });
  assert.equal('householdId' in parsed, false);
});

test('normaliza identificador, consulta mensual y estado', () => {
  assert.deepEqual(budgetIdSchema.parse({ budgetId: '42' }), { budgetId: 42n });
  assert.deepEqual(budgetQuerySchema.parse({ month: '2026-12' }), {
    monthStart: new Date('2026-12-01T00:00:00.000Z'),
  });
  assert.deepEqual(budgetQuerySchema.parse({}), { monthStart: null });
  assert.deepEqual(budgetStatusSchema.parse({ active: 'false' }), { active: false });
});

test('rechaza meses, montos y estados inválidos', () => {
  assert.throws(
    () => budgetBodySchema.parse({ categoryId: '1', month: '2026-13', amount: '10.00' }),
    (error) => error.issues?.[0]?.path?.[0] === 'month',
  );
  assert.throws(
    () => budgetBodySchema.parse({ categoryId: '1', month: '2026-07', amount: '0' }),
    (error) => error.issues?.[0]?.path?.[0] === 'amount',
  );
  assert.throws(
    () => budgetStatusSchema.parse({ active: 'yes' }),
    (error) => error.issues?.[0]?.path?.[0] === 'active',
  );
});

test('clasifica los umbrales 80 y 100 por medio de decimales', () => {
  const limit = new Prisma.Decimal('100.00');
  assert.equal(
    getBudgetProgressState(new Prisma.Decimal('79.99'), limit),
    BUDGET_PROGRESS_STATES.NORMAL,
  );
  assert.equal(
    getBudgetProgressState(new Prisma.Decimal('80.00'), limit),
    BUDGET_PROGRESS_STATES.WARNING,
  );
  assert.equal(
    getBudgetProgressState(new Prisma.Decimal('100.00'), limit),
    BUDGET_PROGRESS_STATES.EXCEEDED,
  );
});
