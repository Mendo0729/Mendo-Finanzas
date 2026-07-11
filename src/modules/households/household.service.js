import { AuthorizationError } from '../../core/errors/app-error.js';
import * as householdRepository from './household.repository.js';
import {
  getHouseholdRole,
  getPermissionEntriesForRole,
  getPermissionsForRole,
} from './household.roles.js';

function parseHouseholdId(value) {
  try {
    const householdId = BigInt(value);
    return householdId > 0n ? householdId : null;
  } catch {
    return null;
  }
}

export function buildHouseholdContext(membership) {
  if (!membership) {
    return null;
  }

  return {
    household: membership.household,
    membership: {
      householdId: membership.householdId,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
    },
    role: getHouseholdRole(membership.role),
    permissions: getPermissionsForRole(membership.role),
    permissionEntries: getPermissionEntriesForRole(membership.role),
  };
}

export async function listAvailableHouseholds(userId) {
  const memberships = await householdRepository.listMembershipsForUser(userId);

  return memberships.map((membership) => {
    const context = buildHouseholdContext(membership);

    return {
      id: context.household.id.toString(),
      name: context.household.name,
      currency: context.household.currency,
      role: context.role,
      permissions: context.permissions,
      joinedAt: context.membership.joinedAt,
    };
  });
}

export async function findHouseholdContext(userId, rawHouseholdId) {
  const householdId = parseHouseholdId(rawHouseholdId);

  if (!householdId) {
    return null;
  }

  const membership = await householdRepository.findMembershipForUser(userId, householdId);
  return buildHouseholdContext(membership);
}

export async function requireHouseholdContextForUser(userId, rawHouseholdId) {
  const context = await findHouseholdContext(userId, rawHouseholdId);

  if (!context) {
    throw new AuthorizationError('No puedes acceder al espacio financiero seleccionado.', {
      code: 'HOUSEHOLD_MEMBERSHIP_REQUIRED',
    });
  }

  return context;
}
