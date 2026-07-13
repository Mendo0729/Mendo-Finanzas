export const DEFAULT_HOUSEHOLD_CURRENCY = 'USD';

export const HOUSEHOLD_CURRENCY_OPTIONS = Object.freeze([
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'PAB', label: 'Balboa panameño (PAB)' },
  { value: 'EUR', label: 'Euro (EUR)' },
]);

export const DEFAULT_HOUSEHOLD_CATEGORIES = Object.freeze([
  { name: 'Salario', categoryType: 1, icon: 'briefcase' },
  { name: 'Trabajo adicional', categoryType: 1, icon: 'laptop' },
  { name: 'Venta', categoryType: 1, icon: 'tag' },
  { name: 'Reembolso', categoryType: 1, icon: 'rotate-ccw' },
  { name: 'Otros ingresos', categoryType: 1, icon: 'plus-circle' },
  { name: 'Alimentación', categoryType: 2, icon: 'utensils' },
  { name: 'Vivienda', categoryType: 2, icon: 'home' },
  { name: 'Transporte', categoryType: 2, icon: 'car' },
  { name: 'Servicios', categoryType: 2, icon: 'receipt' },
  { name: 'Salud', categoryType: 2, icon: 'heart' },
  { name: 'Educación', categoryType: 2, icon: 'book' },
  { name: 'Entretenimiento', categoryType: 2, icon: 'film' },
  { name: 'Compras', categoryType: 2, icon: 'shopping-bag' },
  { name: 'Deudas', categoryType: 2, icon: 'credit-card' },
  { name: 'Suscripciones', categoryType: 2, icon: 'repeat' },
  { name: 'Otros gastos', categoryType: 2, icon: 'more-horizontal' },
]);
