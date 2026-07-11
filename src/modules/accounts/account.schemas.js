import { ACCOUNT_TYPE_OPTIONS, isCreditCard } from './account.constants.js';

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MONEY_PATTERN = /^-?\d{1,12}(?:\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

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

function integer(value, path, { min, max, nullable = false } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if ((normalized === '' || normalized === null || normalized === undefined) && nullable) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw schemaError(path, `Selecciona un valor entre ${min} y ${max}.`);
  }
  return parsed;
}

function money(value, path, { nullable = false, minimum = null } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized === '' && nullable) {
    return null;
  }
  if (!MONEY_PATTERN.test(normalized)) {
    throw schemaError(path, 'Escribe un monto válido con máximo dos decimales.');
  }
  if (minimum !== null && Number(normalized) < minimum) {
    throw schemaError(path, `El monto debe ser mayor o igual a ${minimum}.`);
  }
  return normalized;
}

function parseAccountBody(value) {
  const accountType = integer(value?.accountType, 'accountType', { min: 1, max: 5 });
  if (!ACCOUNT_TYPE_OPTIONS.some(({ value: option }) => option === accountType)) {
    throw schemaError('accountType', 'Selecciona un tipo de cuenta válido.');
  }

  const currency = text(value?.currency, 'currency', { max: 3 })?.toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    throw schemaError('currency', 'La moneda debe usar un código ISO de tres letras.');
  }

  const result = {
    name: text(value?.name, 'name', { max: 100 }),
    accountType,
    currency,
    initialBalance: money(value?.initialBalance ?? '0', 'initialBalance'),
    creditLimit: null,
    closingDay: null,
    paymentDay: null,
  };

  if (isCreditCard(accountType)) {
    result.creditLimit = money(value?.creditLimit, 'creditLimit', { minimum: 0 });
    result.closingDay = integer(value?.closingDay, 'closingDay', { min: 1, max: 31 });
    result.paymentDay = integer(value?.paymentDay, 'paymentDay', { min: 1, max: 31 });
  }

  return result;
}

export const accountBodySchema = Object.freeze({ parse: parseAccountBody });

export const accountIdSchema = Object.freeze({
  parse(value) {
    const raw = value?.accountId;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw schemaError('accountId', 'La cuenta solicitada no es válida.');
    }
    const id = BigInt(raw);
    if (id <= 0n || id > MAX_BIGINT) {
      throw schemaError('accountId', 'La cuenta solicitada no es válida.');
    }
    return { accountId: id };
  },
});

export const accountStatusSchema = Object.freeze({
  parse(value) {
    if (value?.active !== 'true' && value?.active !== 'false') {
      throw schemaError('active', 'El estado solicitado no es válido.');
    }
    return { active: value.active === 'true' };
  },
});
