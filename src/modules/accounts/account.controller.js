import { buildAuditActor } from '../../core/audit/audit.constants.js';
import { ACCOUNT_TYPE_OPTIONS } from './account.constants.js';
import * as accountService from './account.service.js';

function formValues(account = null) {
  return {
    name: account?.name ?? '',
    accountType: account?.accountType ?? ACCOUNT_TYPE_OPTIONS[0].value,
    currency: account?.currency ?? 'USD',
    initialBalance: account?.initialBalance ?? '0.00',
    creditLimit: account?.creditLimit ?? '',
    closingDay: account?.closingDay ?? '',
    paymentDay: account?.paymentDay ?? '',
  };
}

export async function listAccounts(request, response) {
  response.render('accounts/index', {
    pageTitle: 'Cuentas',
    accounts: await accountService.listAccounts(request.context.household.id),
  });
}

export function showCreateAccount(_request, response) {
  response.render('accounts/form', {
    pageTitle: 'Nueva cuenta',
    account: null,
    values: formValues(),
    accountTypes: ACCOUNT_TYPE_OPTIONS,
    action: '/accounts',
  });
}

export async function showEditAccount(request, response) {
  const account = await accountService.requireAccount(
    request.context.household.id,
    request.validated.params.accountId,
  );
  response.render('accounts/form', {
    pageTitle: 'Editar cuenta',
    account,
    values: formValues(account),
    accountTypes: ACCOUNT_TYPE_OPTIONS,
    action: `/accounts/${account.id}`,
  });
}

export async function createAccount(request, response) {
  await accountService.createAccount(
    request.context.household.id,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/accounts');
}

export async function updateAccount(request, response) {
  await accountService.updateAccount(
    request.context.household.id,
    request.validated.params.accountId,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/accounts');
}

export async function changeAccountStatus(request, response) {
  await accountService.setAccountActive(
    request.context.household.id,
    request.validated.params.accountId,
    request.validated.body.active,
    buildAuditActor(request),
  );
  response.redirect(303, '/accounts');
}
