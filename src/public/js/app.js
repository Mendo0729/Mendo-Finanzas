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

  const fullSeries = JSON.parse(chart.dataset.monthlySeries || '[]');
  const currency = chart.dataset.currency || 'USD';
  const defaultPeriod = Number(chart.dataset.defaultPeriod || 6);
  const periodLabel = document.querySelector('[data-chart-period-label]');
  const periodButtons = [...document.querySelectorAll('[data-chart-period]')];
  const scrollContainer = chart.closest('.mf-bar-chart-scroll');
  const allowedPeriods = new Set([3, 6, 12]);

  const render = (requestedPeriod) => {
    const period = allowedPeriods.has(Number(requestedPeriod)) ? Number(requestedPeriod) : 6;
    const series = fullSeries.slice(-period);
    const maximum = Math.max(
      1,
      ...series.flatMap((item) => [Number(item.income), Number(item.expense)]),
    );

    chart.replaceChildren();
    chart.dataset.period = String(period);
    chart.style.setProperty('--mf-chart-columns', String(period));
    chart.style.setProperty(
      '--mf-chart-min-width',
      period === 12 ? '720px' : period === 6 ? '420px' : '280px',
    );

    for (const item of series) {
      const group = document.createElement('div');
      group.className = 'mf-bar-group';

      const incomeValue = Number(item.income);
      const expenseValue = Number(item.expense);
      const periodName = item.year ? `${item.label} ${item.year}` : item.label;

      const income = document.createElement('div');
      income.className = 'mf-bar mf-bar--income';
      income.style.height = `${Math.max(2, (incomeValue / maximum) * 100)}%`;
      income.title = `${periodName}: ingresos ${formatCurrency(incomeValue, currency)}`;

      const expense = document.createElement('div');
      expense.className = 'mf-bar mf-bar--expense';
      expense.style.height = `${Math.max(2, (expenseValue / maximum) * 100)}%`;
      expense.title = `${periodName}: gastos ${formatCurrency(expenseValue, currency)}`;

      const label = document.createElement('span');
      label.className = 'mf-bar-label';
      label.textContent = item.label;
      label.title = periodName;

      group.append(income, expense, label);
      chart.append(group);
    }

    if (periodLabel) {
      periodLabel.textContent = `Últimos ${period} meses`;
    }

    periodButtons.forEach((button) => {
      const selected = Number(button.dataset.chartPeriod) === period;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    if (scrollContainer) {
      requestAnimationFrame(() => {
        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
      });
    }
  };

  periodButtons.forEach((button) => {
    button.addEventListener('click', () => render(button.dataset.chartPeriod));
  });

  render(defaultPeriod);
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
