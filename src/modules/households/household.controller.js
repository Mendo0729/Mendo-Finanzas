import { buildAuditActor } from '../../core/audit/audit.constants.js';
import { saveSession } from '../../core/utils/session.js';
import { DEFAULT_HOUSEHOLD_CURRENCY, HOUSEHOLD_CURRENCY_OPTIONS } from './household.constants.js';
import * as householdService from './household.service.js';

function formValues(household = null) {
  return {
    name: household?.name ?? 'Finanzas personales',
    currency: household?.currency ?? DEFAULT_HOUSEHOLD_CURRENCY,
  };
}

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

export function showCreateHousehold(_request, response) {
  response.render('households/form', {
    pageTitle: 'Nuevo espacio financiero',
    household: null,
    values: formValues(),
    currencies: HOUSEHOLD_CURRENCY_OPTIONS,
    action: '/households',
  });
}

export async function createHousehold(request, response) {
  const household = await householdService.createHousehold(
    request.context.user.id,
    request.validated.body,
    buildAuditActor(request),
  );

  request.session.householdId = household.id;
  request.session.householdSelectedAt = new Date().toISOString();
  await saveSession(request);

  response.redirect(303, '/households/current');
}

export async function showEditHousehold(request, response) {
  const household = await householdService.requireHouseholdForUpdate(
    request.context.user.id,
    request.validated.params.householdId,
  );

  response.render('households/form', {
    pageTitle: 'Editar espacio financiero',
    household,
    values: formValues(household),
    currencies: HOUSEHOLD_CURRENCY_OPTIONS,
    action: `/households/${household.id}`,
  });
}

export async function updateHousehold(request, response) {
  await householdService.updateHousehold(
    request.context.user.id,
    request.validated.params.householdId,
    request.validated.body,
    buildAuditActor(request),
  );

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
  });
}
