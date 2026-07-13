import { Prisma } from '@prisma/client';

import { AuthorizationError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import * as householdRepository from './household.repository.js';
import {
  getHouseholdRole,
  getPermissionEntriesForRole,
  getPermissionsForRole,
} from './household.roles.js';

const MAX_DATABASE_ID = 9_223_372_036_854_775_807n;

function parseHouseholdId(value) {
  try {
    const householdId = BigInt(value);
    return householdId > 0n && householdId <= MAX_DATABASE_ID ? householdId : null;
  } catch {
    return null;
  }
}

function translateWriteError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('Ya tienes un espacio financiero con ese nombre.', {
      code: 'HOUSEHOLD_NAME_CONFLICT',
    });
  }
  throw error;
}

function mapHousehold(household) {
  return {
    ...household,
    id: household.id.toString(),
    createdBy: household.createdBy.toString(),
  };
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

export async function createHousehold(userId, data, actor) {
  try {
    return mapHousehold(await householdRepository.createHousehold(userId, data, actor));
  } catch (error) {
    translateWriteError(error);
  }
}

export async function requireHouseholdForUpdate(userId, rawHouseholdId) {
  const householdId = parseHouseholdId(rawHouseholdId);
  if (!householdId) {
    throw new NotFoundError('El espacio financiero solicitado no existe.', {
      code: 'HOUSEHOLD_NOT_FOUND',
    });
  }

  const household = await householdRepository.findHouseholdForUpdate(userId, householdId);
  if (!household) {
    throw new NotFoundError('El espacio financiero solicitado no existe.', {
      code: 'HOUSEHOLD_NOT_FOUND',
    });
  }

  return mapHousehold(household);
}

export async function updateHousehold(userId, rawHouseholdId, data, actor) {
  const householdId = parseHouseholdId(rawHouseholdId);
  if (!householdId) {
    throw new NotFoundError('El espacio financiero solicitado no existe.', {
      code: 'HOUSEHOLD_NOT_FOUND',
    });
  }

  try {
    const household = await householdRepository.updateHousehold(userId, householdId, data, actor);
    if (!household) {
      throw new NotFoundError('El espacio financiero solicitado no existe.', {
        code: 'HOUSEHOLD_NOT_FOUND',
      });
    }
    return mapHousehold(household);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    translateWriteError(error);
  }
}
