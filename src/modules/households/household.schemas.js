const MAX_DATABASE_ID = 9_223_372_036_854_775_807n;

function createSchemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

function parseHouseholdIdValue(rawHouseholdId) {
  if (typeof rawHouseholdId !== 'string' || !/^\d+$/.test(rawHouseholdId.trim())) {
    throw createSchemaError('householdId', 'Selecciona un espacio financiero válido.');
  }

  const householdId = BigInt(rawHouseholdId.trim());
  if (householdId <= 0n || householdId > MAX_DATABASE_ID) {
    throw createSchemaError('householdId', 'Selecciona un espacio financiero válido.');
  }

  return householdId.toString();
}

function parseName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 100) {
    throw createSchemaError('name', 'El nombre debe tener entre 2 y 100 caracteres.');
  }
  return name;
}

function parseCurrency(value) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createSchemaError('currency', 'La moneda debe ser un código de tres letras.');
  }
  return currency;
}

export const householdSelectionSchema = Object.freeze({
  parse(value) {
    return { householdId: parseHouseholdIdValue(value?.householdId) };
  },
});

export const householdIdParamsSchema = Object.freeze({
  parse(value) {
    return { householdId: parseHouseholdIdValue(value?.householdId) };
  },
});

export const householdWriteSchema = Object.freeze({
  parse(value) {
    return {
      name: parseName(value?.name),
      currency: parseCurrency(value?.currency),
    };
  },
});
