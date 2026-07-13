export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 1,
  UPDATE: 2,
  ACTIVATE: 3,
  DEACTIVATE: 4,
});

export const AUDIT_ENTITY_TYPES = Object.freeze({
  ACCOUNT: 1,
  CATEGORY: 2,
  HOUSEHOLD: 3,
});

export function buildAuditActor(request, householdId = request.context?.household?.id ?? null) {
  return {
    userId: request.context.user.id,
    householdId,
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent')?.slice(0, 255) ?? null,
  };
}
