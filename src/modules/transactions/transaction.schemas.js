import {
  isEditableTransactionType,
  isTransactionSort,
  TRANSACTION_SORTS,
} from './transaction.constants.js';

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const ZERO_MONEY_PATTERN = /^0+(?:\.0{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE = 100_000;

function schemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

function text(value, path, { max, required = true } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && normalized.length === 0) {
    throw schemaError(path, 'Este campo es obligatorio.');
  }
  if (normalized.length > max) {
    throw schemaError(path, `Este campo no puede superar ${max} caracteres.`);
  }
  return normalized || null;
}

function optionalText(value, path, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw schemaError(path, 'El valor enviado no es válido.');
  }
  return text(value, path, { max, required: false });
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

function optionalBigint(value, path) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return bigint(value, path);
}

function money(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!MONEY_PATTERN.test(normalized)) {
    throw schemaError('amount', 'Escribe un monto válido con máximo dos decimales.');
  }
  if (ZERO_MONEY_PATTERN.test(normalized)) {
    throw schemaError('amount', 'El monto debe ser mayor que cero.');
  }
  return normalized;
}

function optionalMoney(value, path) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value.trim())) {
    throw schemaError(path, 'Escribe un monto válido con máximo dos decimales.');
  }
  return value.trim();
}

function parseDate(value, path) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!DATE_PATTERN.test(normalized)) {
    throw schemaError(path, 'Selecciona una fecha válida.');
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw schemaError(path, 'Selecciona una fecha válida.');
  }
  return parsed;
}

function transactionDate(value) {
  return parseDate(value, 'transactionDate');
}

function optionalDate(value, path) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parseDate(value, path);
}

function optionalTransactionType(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !isEditableTransactionType(parsed)) {
    throw schemaError('transactionType', 'Selecciona un tipo de movimiento válido.');
  }
  return parsed;
}

function page(value) {
  if (value === undefined || value === null || value === '') {
    return 1;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw schemaError('page', 'La página solicitada no es válida.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PAGE) {
    throw schemaError('page', 'La página solicitada no es válida.');
  }
  return parsed;
}

function sort(value) {
  if (value === undefined || value === null || value === '') {
    return TRANSACTION_SORTS.DATE_DESC;
  }
  if (typeof value !== 'string' || !isTransactionSort(value)) {
    throw schemaError('sort', 'El orden solicitado no es válido.');
  }
  return value;
}

function moneyToCents(value) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export const transactionBodySchema = Object.freeze({
  parse(value) {
    const parsedType = Number(value?.transactionType);
    if (!Number.isInteger(parsedType) || !isEditableTransactionType(parsedType)) {
      throw schemaError('transactionType', 'Selecciona un tipo de movimiento válido.');
    }

    return {
      transactionType: parsedType,
      accountId: bigint(value?.accountId, 'accountId'),
      categoryId: bigint(value?.categoryId, 'categoryId'),
      description: text(value?.description, 'description', { max: 160 }),
      amount: money(value?.amount),
      transactionDate: transactionDate(value?.transactionDate),
      notes: text(value?.notes, 'notes', { max: 1000, required: false }),
    };
  },
});

export const transactionIdSchema = Object.freeze({
  parse(value) {
    return { transactionId: bigint(value?.transactionId, 'transactionId') };
  },
});

export const transactionQuerySchema = Object.freeze({
  parse(value) {
    const fromDate = optionalDate(value?.fromDate, 'fromDate');
    const toDate = optionalDate(value?.toDate, 'toDate');
    const minAmount = optionalMoney(value?.minAmount, 'minAmount');
    const maxAmount = optionalMoney(value?.maxAmount, 'maxAmount');

    if (fromDate && toDate && fromDate > toDate) {
      throw schemaError('toDate', 'La fecha final no puede ser anterior a la fecha inicial.');
    }
    if (minAmount && maxAmount && moneyToCents(minAmount) > moneyToCents(maxAmount)) {
      throw schemaError('maxAmount', 'El monto máximo no puede ser menor que el monto mínimo.');
    }

    return {
      search: optionalText(value?.search, 'search', 100),
      fromDate,
      toDate,
      accountId: optionalBigint(value?.accountId, 'accountId'),
      categoryId: optionalBigint(value?.categoryId, 'categoryId'),
      transactionType: optionalTransactionType(value?.transactionType),
      minAmount,
      maxAmount,
      page: page(value?.page),
      sort: sort(value?.sort),
    };
  },
});
