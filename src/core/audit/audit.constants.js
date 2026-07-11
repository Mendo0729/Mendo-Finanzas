export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 1,
  UPDATE: 2,
  ACTIVATE: 3,
  DEACTIVATE: 4,
});

export const AUDIT_ENTITY_TYPES = Object.freeze({
  ACCOUNT: 1,
  CATEGORY: 2,
});

export function buildAuditActor(request) {
  return {
    userId: request.context.user.id,
    householdId: request.context.household.id,
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent')?.slice(0, 255) ?? null,
  };
}
