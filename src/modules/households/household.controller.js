import { saveSession } from '../../core/utils/session.js';
import * as householdService from './household.service.js';
import { getPermissionEntriesForRole } from './household.roles.js';

export async function showHouseholdSelection(request, response) {
  const households = await householdService.listAvailableHouseholds(request.context.user.id);

  response.render('households/select', {
    pageTitle: 'Seleccionar espacio',
    households,
    selectedHouseholdId: request.context?.household?.id?.toString() ?? null,
  });
}

export async function selectHousehold(request, response) {
  const context = await householdService.requireHouseholdContextForUser(
    request.context.user.id,
    request.validated.body.householdId,
  );

  request.session.householdId = context.household.id.toString();
  request.session.householdSelectedAt = new Date().toISOString();
  await saveSession(request);

  response.redirect(303, '/households/current');
}

export function showCurrentHousehold(request, response) {
  const { household, membership, householdRole } = request.context;

  response.render('households/current', {
    pageTitle: household.name,
    household: {
      id: household.id.toString(),
      name: household.name,
      currency: household.currency,
      createdAt: household.createdAt,
    },
    role: householdRole,
    joinedAt: membership.joinedAt,
    permissions: getPermissionEntriesForRole(membership.role),
  });
}
