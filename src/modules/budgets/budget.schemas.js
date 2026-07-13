const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const ZERO_MONEY_PATTERN = /^0+(?:\.0{1,2})?$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function schemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

function bigint(value, path) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(normalized)) {
    throw schemaError(path, 'Selecciona una opción válida.');
  }
  const parsed = BigInt(normalized);
  if (parsed <= 0n || parsed > MAX_BIGINT) {
    throw schemaError(path, 'Selecciona una opción válida.');
  }
  return parsed;
}

function amount(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!MONEY_PATTERN.test(normalized)) {
    throw schemaError('amount', 'Escribe un monto válido con máximo dos decimales.');
  }
  if (ZERO_MONEY_PATTERN.test(normalized)) {
    throw schemaError('amount', 'El límite debe ser mayor que cero.');
  }
  return normalized;
}

function month(value, path, required = true) {
  if (!required && (value === undefined || value === null || value === '')) {
    return null;
  }
  const normalized = typeof value === 'string' ? value.trim() : '';
  const match = MONTH_PATTERN.exec(normalized);
  if (!match) {
    throw schemaError(path, 'Selecciona un mes válido.');
  }
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 2000 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
    throw schemaError(path, 'Selecciona un mes válido.');
  }
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

export const budgetBodySchema = Object.freeze({
  parse(value) {
    return {
      categoryId: bigint(value?.categoryId, 'categoryId'),
      monthStart: month(value?.month, 'month'),
      amount: amount(value?.amount),
    };
  },
});

export const budgetIdSchema = Object.freeze({
  parse(value) {
    return { budgetId: bigint(value?.budgetId, 'budgetId') };
  },
});

export const budgetStatusSchema = Object.freeze({
  parse(value) {
    if (value?.active !== 'true' && value?.active !== 'false') {
      throw schemaError('active', 'El estado solicitado no es válido.');
    }
    return { active: value.active === 'true' };
  },
});

export const budgetQuerySchema = Object.freeze({
  parse(value) {
    return { monthStart: month(value?.month, 'month', false) };
  },
});
