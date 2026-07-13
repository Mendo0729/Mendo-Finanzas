import { buildAuditActor } from '../../core/audit/audit.constants.js';
import * as budgetService from './budget.service.js';

function formValues(budget = null, defaultMonth = null) {
  return {
    categoryId: budget?.categoryId ?? '',
    month: budget?.month ?? budgetService.monthKey(defaultMonth ?? budgetService.currentMonthStart()),
    amount: budget?.amount ?? '',
  };
}

async function renderBudgetForm(response, householdId, budget = null, defaultMonth = null) {
  response.render('budgets/form', {
    pageTitle: budget ? 'Editar presupuesto' : 'Nuevo presupuesto',
    budget,
    values: formValues(budget, defaultMonth),
    action: budget ? `/budgets/${budget.id}` : '/budgets',
    submitLabel: budget ? 'Guardar cambios' : 'Crear presupuesto',
    ...(await budgetService.getBudgetFormOptions(householdId)),
  });
}

export async function listBudgets(request, response) {
  response.render('budgets/index', {
    pageTitle: 'Presupuestos',
    ...(await budgetService.getBudgetOverview(
      request.context.household.id,
      request.validated.query.monthStart,
    )),
  });
}

export async function showCreateBudget(request, response) {
  await renderBudgetForm(
    response,
    request.context.household.id,
    null,
    request.validated.query.monthStart,
  );
}

export async function showEditBudget(request, response) {
  const budget = await budgetService.requireBudget(
    request.context.household.id,
    request.validated.params.budgetId,
  );
  await renderBudgetForm(response, request.context.household.id, budget);
}

export async function createBudget(request, response) {
  const budget = await budgetService.createBudget(
    request.context.household.id,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, `/budgets?month=${budget.month}`);
}

export async function updateBudget(request, response) {
  const budget = await budgetService.updateBudget(
    request.context.household.id,
    request.validated.params.budgetId,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, `/budgets?month=${budget.month}`);
}

export async function changeBudgetStatus(request, response) {
  const budget = await budgetService.setBudgetActive(
    request.context.household.id,
    request.validated.params.budgetId,
    request.validated.body.active,
    buildAuditActor(request),
  );
  response.redirect(303, `/budgets?month=${budget.month}`);
}
