import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthorizationError, ConflictError } from '../../src/core/errors/app-error.js';
import {
  requireHouseholdMembership,
  requireHouseholdPermission,
  requireHouseholdRole,
  requireHouseholdScope,
} from '../../src/modules/households/household.middleware.js';
import {
  getHouseholdRole,
  getPermissionsForRole,
  HOUSEHOLD_PERMISSIONS,
  HOUSEHOLD_ROLES,
  roleHasPermission,
} from '../../src/modules/households/household.roles.js';

function invoke(middleware, request = {}) {
  const response = {
    redirect(statusCode, location) {
      response.redirected = { statusCode, location };
    },
  };
  let nextCalled = false;
  let nextError = null;

  middleware(request, response, (error) => {
    nextCalled = true;
    nextError = error ?? null;
  });

  return { response, nextCalled, nextError };
}

test('la matriz asigna capacidades distintas a los cuatro roles', () => {
  assert.equal(getHouseholdRole(HOUSEHOLD_ROLES.OWNER).label, 'Propietario');
  assert.equal(getHouseholdRole(HOUSEHOLD_ROLES.ADMIN).label, 'Administrador');
  assert.equal(getHouseholdRole(HOUSEHOLD_ROLES.EDITOR).label, 'Editor');
  assert.equal(getHouseholdRole(HOUSEHOLD_ROLES.VIEWER).label, 'Solo lectura');

  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.OWNER, HOUSEHOLD_PERMISSIONS.HOUSEHOLD_DELETE),
    true,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.ADMIN, HOUSEHOLD_PERMISSIONS.MEMBERS_MANAGE),
    true,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.ADMIN, HOUSEHOLD_PERMISSIONS.HOUSEHOLD_DELETE),
    false,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.EDITOR, HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE),
    true,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.EDITOR, HOUSEHOLD_PERMISSIONS.MEMBERS_MANAGE),
    false,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.VIEWER, HOUSEHOLD_PERMISSIONS.TRANSACTIONS_VIEW),
    true,
  );
  assert.equal(
    roleHasPermission(HOUSEHOLD_ROLES.VIEWER, HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE),
    false,
  );
  assert.deepEqual(getPermissionsForRole(999), []);
});

test('el middleware de permisos autoriza por rol y rechaza capacidades ausentes', () => {
  const allowed = invoke(requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE), {
    context: { membership: { role: HOUSEHOLD_ROLES.EDITOR } },
  });
  assert.equal(allowed.nextCalled, true);
  assert.equal(allowed.nextError, null);

  const denied = invoke(requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE), {
    context: { membership: { role: HOUSEHOLD_ROLES.VIEWER } },
  });
  assert.ok(denied.nextError instanceof AuthorizationError);
  assert.equal(denied.nextError.code, 'HOUSEHOLD_PERMISSION_DENIED');

  const missingContext = invoke(requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_VIEW), {
    context: {},
  });
  assert.ok(missingContext.nextError instanceof ConflictError);
  assert.equal(missingContext.nextError.code, 'HOUSEHOLD_REQUIRED');
});

test('el middleware de roles exige uno de los roles permitidos', () => {
  const middleware = requireHouseholdRole(HOUSEHOLD_ROLES.OWNER, HOUSEHOLD_ROLES.ADMIN);

  assert.equal(
    invoke(middleware, {
      context: { membership: { role: HOUSEHOLD_ROLES.ADMIN } },
    }).nextError,
    null,
  );

  const denied = invoke(middleware, {
    context: { membership: { role: HOUSEHOLD_ROLES.EDITOR } },
  });
  assert.ok(denied.nextError instanceof AuthorizationError);
  assert.equal(denied.nextError.code, 'HOUSEHOLD_ROLE_DENIED');
});

test('el middleware de alcance rechaza identificadores de otro espacio', () => {
  const middleware = requireHouseholdScope((request) => request.params.householdId);
  const request = {
    context: { household: { id: 10n } },
    params: { householdId: '10' },
  };

  assert.equal(invoke(middleware, request).nextError, null);

  const denied = invoke(middleware, {
    ...request,
    params: { householdId: '11' },
  });
  assert.ok(denied.nextError instanceof AuthorizationError);
  assert.equal(denied.nextError.code, 'HOUSEHOLD_SCOPE_DENIED');

  const invalid = invoke(middleware, {
    ...request,
    params: { householdId: 'invalido' },
  });
  assert.ok(invalid.nextError instanceof AuthorizationError);
  assert.equal(invalid.nextError.code, 'HOUSEHOLD_SCOPE_DENIED');
});

test('la membresía ausente redirige lecturas y rechaza escrituras', () => {
  const readResult = invoke(requireHouseholdMembership, {
    method: 'GET',
    context: {},
  });
  assert.deepEqual(readResult.response.redirected, {
    statusCode: 303,
    location: '/households/select',
  });
  assert.equal(readResult.nextCalled, false);

  const writeResult = invoke(requireHouseholdMembership, {
    method: 'POST',
    context: {},
  });
  assert.ok(writeResult.nextError instanceof ConflictError);
  assert.equal(writeResult.nextError.code, 'HOUSEHOLD_REQUIRED');
});
