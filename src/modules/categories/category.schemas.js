import { CATEGORY_TYPE_OPTIONS } from './category.constants.js';

const MAX_BIGINT = 9_223_372_036_854_775_807n;

function schemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

function text(value, path, max, required = true) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (required && normalized.length === 0) {
    throw schemaError(path, 'Este campo es obligatorio.');
  }
  if (normalized.length > max) {
    throw schemaError(path, `Este campo no puede superar ${max} caracteres.`);
  }
  return normalized || null;
}

export const categoryBodySchema = Object.freeze({
  parse(value) {
    const categoryType = Number(value?.categoryType);
    if (!CATEGORY_TYPE_OPTIONS.some(({ value: option }) => option === categoryType)) {
      throw schemaError('categoryType', 'Selecciona un tipo de categoría válido.');
    }

    return {
      name: text(value?.name, 'name', 60),
      categoryType,
      icon: text(value?.icon, 'icon', 40, false),
    };
  },
});

export const categoryIdSchema = Object.freeze({
  parse(value) {
    const raw = value?.categoryId;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw schemaError('categoryId', 'La categoría solicitada no es válida.');
    }
    const id = BigInt(raw);
    if (id <= 0n || id > MAX_BIGINT) {
      throw schemaError('categoryId', 'La categoría solicitada no es válida.');
    }
    return { categoryId: id };
  },
});

export const categoryStatusSchema = Object.freeze({
  parse(value) {
    if (value?.active !== 'true' && value?.active !== 'false') {
      throw schemaError('active', 'El estado solicitado no es válido.');
    }
    return { active: value.active === 'true' };
  },
});
