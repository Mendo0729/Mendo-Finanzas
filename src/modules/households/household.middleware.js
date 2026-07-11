import { AuthorizationError, ConflictError } from '../../core/errors/app-error.js';
import * as householdService from './household.service.js';
import { roleHasPermission } from './household.roles.js';

function clearHouseholdSelection(request) {
  if (!request.session) {
    return;
  }

  delete request.session.householdId;
  delete request.session.householdSelectedAt;
}

function initializeHouseholdLocals(response) {
  response.locals.currentHousehold = null;
  response.locals.currentHouseholdRole = null;
  response.locals.householdPermissions = [];
}

function toSafeHousehold(household) {
  return {
    id: household.id.toString(),
    name: household.name,
    currency: household.currency,
  };
}

function householdRequiredError() {
  return new ConflictError('Selecciona un espacio financiero para continuar.', {
    code: 'HOUSEHOLD_REQUIRED',
  });
}

export async function loadHouseholdContext(request, response, next) {
  initializeHouseholdLocals(response);

  const user = request.context?.user;
  const selectedHouseholdId = request.session?.householdId;

  if (!user || !selectedHouseholdId) {
    next();
    return;
  }

  try {
    const context = await householdService.findHouseholdContext(user.id, selectedHouseholdId);

    if (!context) {
      clearHouseholdSelection(request);
      next();
      return;
    }

    request.context = {
      ...(request.context ?? {}),
      household: context.household,
      membership: context.membership,
      householdRole: context.role,
      householdPermissions: new Set(context.permissions),
    };

    response.locals.currentHousehold = toSafeHousehold(context.household);
    response.locals.currentHouseholdRole = context.role;
    response.locals.householdPermissions = [...context.permissions];
    next();
  } catch (error) {
    next(error);
  }
}

export function requireHouseholdMembership(request, response, next) {
  if (request.context?.household && request.context?.membership) {
    next();
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    response.redirect(303, '/households/select');
    return;
  }

  next(householdRequiredError());
}

export function requireHouseholdRole(...allowedRoles) {
  const allowedRoleSet = new Set(allowedRoles);

  return function householdRoleMiddleware(request, _response, next) {
    const membership = request.context?.membership;

    if (!membership) {
      next(householdRequiredError());
      return;
    }

    if (!allowedRoleSet.has(membership.role)) {
      next(
        new AuthorizationError('Tu rol no permite realizar esta acción.', {
          code: 'HOUSEHOLD_ROLE_DENIED',
        }),
      );
      return;
    }

    next();
  };
}

export function requireHouseholdPermission(permission) {
  return function householdPermissionMiddleware(request, _response, next) {
    const membership = request.context?.membership;

    if (!membership) {
      next(householdRequiredError());
      return;
    }

    if (!roleHasPermission(membership.role, permission)) {
      next(
        new AuthorizationError('No tienes permiso para realizar esta acción.', {
          code: 'HOUSEHOLD_PERMISSION_DENIED',
        }),
      );
      return;
    }

    next();
  };
}

export function requireHouseholdScope(resolveHouseholdId) {
  return function householdScopeMiddleware(request, _response, next) {
    const activeHouseholdId = request.context?.household?.id;

    if (!activeHouseholdId) {
      next(householdRequiredError());
      return;
    }

    let requestedHouseholdId;
    try {
      requestedHouseholdId = BigInt(resolveHouseholdId(request));
    } catch {
      next(
        new AuthorizationError('No puedes acceder a datos de otro espacio financiero.', {
          code: 'HOUSEHOLD_SCOPE_DENIED',
        }),
      );
      return;
    }

    if (requestedHouseholdId !== activeHouseholdId) {
      next(
        new AuthorizationError('No puedes acceder a datos de otro espacio financiero.', {
          code: 'HOUSEHOLD_SCOPE_DENIED',
        }),
      );
      return;
    }

    next();
  };
}
