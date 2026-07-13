import { isEditableTransactionType } from './transaction.constants.js';

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const ZERO_MONEY_PATTERN = /^0+(?:\.0{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function transactionDate(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!DATE_PATTERN.test(normalized)) {
    throw schemaError('transactionDate', 'Selecciona una fecha válida.');
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw schemaError('transactionDate', 'Selecciona una fecha válida.');
  }
  return parsed;
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
