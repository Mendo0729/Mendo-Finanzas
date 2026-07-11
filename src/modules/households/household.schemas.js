function createSchemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

export const householdSelectionSchema = Object.freeze({
  parse(value) {
    const rawHouseholdId = value?.householdId;

    if (typeof rawHouseholdId !== 'string' || !/^\d+$/.test(rawHouseholdId.trim())) {
      throw createSchemaError('householdId', 'Selecciona un espacio financiero válido.');
    }

    const householdId = BigInt(rawHouseholdId.trim());
    if (householdId <= 0n) {
      throw createSchemaError('householdId', 'Selecciona un espacio financiero válido.');
    }

    return {
      householdId: householdId.toString(),
    };
  },
});
