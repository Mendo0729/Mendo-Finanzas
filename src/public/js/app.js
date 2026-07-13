document.documentElement.classList.add('js-enabled');

function formatCurrency(value, currency) {
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function initializeCurrencyValues() {
  document.querySelectorAll('[data-currency-value]').forEach((element) => {
    element.textContent = formatCurrency(
      element.dataset.currencyValue,
      element.dataset.currency || 'USD',
    );
  });
}

function initializeSidebar() {
  const toggle = document.querySelector('[data-sidebar-toggle]');
  const closeTargets = document.querySelectorAll('[data-sidebar-close]');

  if (!toggle) return;

  const setOpen = (open) => {
    document.body.classList.toggle('is-sidebar-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('is-sidebar-open'));
  });

  closeTargets.forEach((element) => element.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

function initializeBarChart() {
  const chart = document.querySelector('[data-monthly-series]');
  if (!chart) return;

  const series = JSON.parse(chart.dataset.monthlySeries || '[]');
  const maximum = Math.max(1, ...series.flatMap((item) => [item.income, item.expense]));

  for (const item of series) {
    const group = document.createElement('div');
    group.className = 'mf-bar-group';

    const income = document.createElement('div');
    income.className = 'mf-bar mf-bar--income';
    income.style.height = `${Math.max(2, (item.income / maximum) * 100)}%`;
    income.title = `${item.label}: ingresos ${formatCurrency(item.income, 'USD')}`;

    const expense = document.createElement('div');
    expense.className = 'mf-bar mf-bar--expense';
    expense.style.height = `${Math.max(2, (item.expense / maximum) * 100)}%`;
    expense.title = `${item.label}: gastos ${formatCurrency(item.expense, 'USD')}`;

    const label = document.createElement('span');
    label.className = 'mf-bar-label';
    label.textContent = item.label;

    group.append(income, expense, label);
    chart.append(group);
  }
}

function initializeCategoryChart() {
  const chart = document.querySelector('[data-category-expenses]');
  if (!chart) return;

  const categories = JSON.parse(chart.dataset.categoryExpenses || '[]');
  const total = categories.reduce((sum, item) => sum + Number(item.amount), 0);
  const donut = chart.querySelector('.mf-donut');
  const list = chart.querySelector('.mf-category-list');
  const palette = ['#0aaa73', '#35c497', '#93dfc2', '#ffc55f', '#e94b67'];

  let cursor = 0;
  const gradientParts = categories.map((item, index) => {
    const percentage = total > 0 ? (Number(item.amount) / total) * 100 : 0;
    const start = cursor;
    cursor += percentage;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  if (gradientParts.length) donut.style.background = `conic-gradient(${gradientParts.join(',')})`;

  categories.forEach((item, index) => {
    const percentage = total > 0 ? Math.round((Number(item.amount) / total) * 100) : 0;
    const row = document.createElement('li');
    const marker = document.createElement('i');
    const name = document.createElement('span');
    const amount = document.createElement('strong');

    marker.style.background = palette[index % palette.length];
    name.textContent = `${item.name ?? 'Sin categoría'} · ${percentage}%`;
    amount.textContent = formatCurrency(item.amount, 'USD');
    row.append(marker, name, amount);
    list.append(row);
  });
}

initializeCurrencyValues();
initializeSidebar();
initializeBarChart();
initializeCategoryChart();
