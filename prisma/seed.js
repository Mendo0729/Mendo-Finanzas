import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_STATUS_ACTIVE = 1;
const ROLE_OWNER = 1;

const ACCOUNT_TYPES = Object.freeze({
  CASH: 1,
  CHECKING: 2,
  SAVINGS: 3,
  CREDIT_CARD: 4,
  DIGITAL_WALLET: 5,
});

const CATEGORY_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
});

const TRANSACTION_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
  TRANSFER_OUT: 3,
  TRANSFER_IN: 4,
});

const TRANSACTION_STATUS = Object.freeze({
  PENDING: 0,
  CONFIRMED: 1,
});

const developmentUser = {
  name: 'Usuario de desarrollo',
  email: 'demo@mendofinanzas.local',
  passwordHash: 'DEVELOPMENT_ONLY_NOT_A_REAL_PASSWORD_HASH',
};

const accountDefinitions = [
  {
    name: 'Efectivo',
    accountType: ACCOUNT_TYPES.CASH,
    initialBalance: '150.00',
  },
  {
    name: 'Cuenta corriente',
    accountType: ACCOUNT_TYPES.CHECKING,
    initialBalance: '1800.00',
  },
  {
    name: 'Cuenta de ahorro',
    accountType: ACCOUNT_TYPES.SAVINGS,
    initialBalance: '2500.00',
  },
  {
    name: 'Tarjeta Visa',
    accountType: ACCOUNT_TYPES.CREDIT_CARD,
    initialBalance: '0.00',
    creditLimit: '3000.00',
    closingDay: 20,
    paymentDay: 5,
  },
  {
    name: 'Billetera digital',
    accountType: ACCOUNT_TYPES.DIGITAL_WALLET,
    initialBalance: '100.00',
  },
];

const categoryDefinitions = [
  { name: 'Salario', categoryType: CATEGORY_TYPES.INCOME, icon: 'briefcase' },
  { name: 'Trabajo adicional', categoryType: CATEGORY_TYPES.INCOME, icon: 'laptop' },
  { name: 'Venta', categoryType: CATEGORY_TYPES.INCOME, icon: 'tag' },
  { name: 'Reembolso', categoryType: CATEGORY_TYPES.INCOME, icon: 'rotate-ccw' },
  { name: 'Otros ingresos', categoryType: CATEGORY_TYPES.INCOME, icon: 'plus-circle' },
  { name: 'Alimentación', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'utensils' },
  { name: 'Vivienda', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'home' },
  { name: 'Transporte', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'car' },
  { name: 'Servicios', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'receipt' },
  { name: 'Salud', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'heart' },
  { name: 'Educación', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'book' },
  { name: 'Entretenimiento', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'film' },
  { name: 'Compras', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'shopping-bag' },
  { name: 'Deudas', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'credit-card' },
  { name: 'Suscripciones', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'repeat' },
  { name: 'Otros gastos', categoryType: CATEGORY_TYPES.EXPENSE, icon: 'more-horizontal' },
];

function decimal(value) {
  return new Prisma.Decimal(value);
}

function currentMonthDate(day) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
}

async function seedUser() {
  const user = await prisma.user.upsert({
    where: { email: developmentUser.email },
    update: {
      name: developmentUser.name,
      status: USER_STATUS_ACTIVE,
      emailVerifiedAt: new Date(),
    },
    create: {
      ...developmentUser,
      status: USER_STATUS_ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userMfa.upsert({
    where: { userId: user.id },
    update: { enabled: false, totpSecretEncrypted: null, enabledAt: null },
    create: { userId: user.id, enabled: false },
  });

  return user;
}

async function seedHousehold(userId) {
  const household = await prisma.household.upsert({
    where: {
      createdBy_name: {
        createdBy: userId,
        name: 'Finanzas personales',
      },
    },
    update: { currency: 'USD' },
    create: {
      name: 'Finanzas personales',
      currency: 'USD',
      createdBy: userId,
    },
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId,
      },
    },
    update: { role: ROLE_OWNER },
    create: {
      householdId: household.id,
      userId,
      role: ROLE_OWNER,
    },
  });

  return household;
}

async function seedAccounts(householdId) {
  const accounts = new Map();

  for (const definition of accountDefinitions) {
    const account = await prisma.account.upsert({
      where: {
        householdId_name: {
          householdId,
          name: definition.name,
        },
      },
      update: {
        accountType: definition.accountType,
        currency: 'USD',
        initialBalance: decimal(definition.initialBalance),
        creditLimit: definition.creditLimit ? decimal(definition.creditLimit) : null,
        closingDay: definition.closingDay ?? null,
        paymentDay: definition.paymentDay ?? null,
        active: true,
      },
      create: {
        householdId,
        name: definition.name,
        accountType: definition.accountType,
        currency: 'USD',
        initialBalance: decimal(definition.initialBalance),
        creditLimit: definition.creditLimit ? decimal(definition.creditLimit) : null,
        closingDay: definition.closingDay ?? null,
        paymentDay: definition.paymentDay ?? null,
        active: true,
      },
    });

    accounts.set(account.name, account);
  }

  return accounts;
}

async function seedCategories(householdId) {
  const categories = new Map();

  for (const definition of categoryDefinitions) {
    const category = await prisma.category.upsert({
      where: {
        householdId_categoryType_name: {
          householdId,
          categoryType: definition.categoryType,
          name: definition.name,
        },
      },
      update: {
        icon: definition.icon,
        isDefault: true,
        active: true,
      },
      create: {
        householdId,
        ...definition,
        isDefault: true,
        active: true,
      },
    });

    categories.set(category.name, category);
  }

  return categories;
}

async function seedBudgets(householdId, categories) {
  const monthStart = currentMonthDate(1);
  const definitions = [
    ['Alimentación', '450.00'],
    ['Transporte', '180.00'],
    ['Servicios', '250.00'],
    ['Entretenimiento', '120.00'],
    ['Suscripciones', '80.00'],
  ];

  for (const [categoryName, amount] of definitions) {
    const category = categories.get(categoryName);

    await prisma.budget.upsert({
      where: {
        householdId_categoryId_monthStart: {
          householdId,
          categoryId: category.id,
          monthStart,
        },
      },
      update: { amount: decimal(amount) },
      create: {
        householdId,
        categoryId: category.id,
        monthStart,
        amount: decimal(amount),
      },
    });
  }
}

async function seedTransactions(householdId, userId, accounts, categories) {
  await prisma.transaction.deleteMany({
    where: {
      householdId,
      description: { startsWith: '[SEED]' },
    },
  });

  const checking = accounts.get('Cuenta corriente');
  const savings = accounts.get('Cuenta de ahorro');
  const cash = accounts.get('Efectivo');
  const creditCard = accounts.get('Tarjeta Visa');
  const wallet = accounts.get('Billetera digital');
  const transferGroupId = randomUUID();

  const transactions = [
    {
      accountId: checking.id,
      categoryId: categories.get('Salario').id,
      transactionType: TRANSACTION_TYPES.INCOME,
      amount: decimal('1850.00'),
      description: '[SEED] Salario mensual',
      transactionDate: currentMonthDate(1),
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Trabajo adicional').id,
      transactionType: TRANSACTION_TYPES.INCOME,
      amount: decimal('250.00'),
      description: '[SEED] Trabajo independiente',
      transactionDate: currentMonthDate(3),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Alimentación').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('86.42'),
      description: '[SEED] Supermercado',
      transactionDate: currentMonthDate(4),
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Vivienda').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('650.00'),
      description: '[SEED] Alquiler',
      transactionDate: currentMonthDate(5),
    },
    {
      accountId: wallet.id,
      categoryId: categories.get('Transporte').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('18.50'),
      description: '[SEED] Transporte',
      transactionDate: currentMonthDate(6),
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Servicios').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('45.00'),
      description: '[SEED] Internet',
      transactionDate: currentMonthDate(7),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Salud').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('32.75'),
      description: '[SEED] Farmacia',
      transactionDate: currentMonthDate(8),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Educación').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('24.99'),
      description: '[SEED] Curso en línea',
      transactionDate: currentMonthDate(9),
    },
    {
      accountId: cash.id,
      categoryId: categories.get('Entretenimiento').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('22.00'),
      description: '[SEED] Cine',
      transactionDate: currentMonthDate(10),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Compras').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('58.30'),
      description: '[SEED] Compra para el hogar',
      transactionDate: currentMonthDate(11),
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Deudas').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('125.00'),
      description: '[SEED] Pago de préstamo',
      transactionDate: currentMonthDate(12),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Suscripciones').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('15.99'),
      description: '[SEED] Suscripción mensual',
      transactionDate: currentMonthDate(13),
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Alimentación').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('42.15'),
      description: '[SEED] Restaurante',
      transactionDate: currentMonthDate(14),
    },
    {
      accountId: wallet.id,
      categoryId: categories.get('Transporte').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('12.25'),
      description: '[SEED] Viaje local',
      transactionDate: currentMonthDate(15),
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Servicios').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('37.60'),
      description: '[SEED] Electricidad',
      transactionDate: currentMonthDate(16),
    },
    {
      accountId: cash.id,
      categoryId: categories.get('Compras').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('19.90'),
      description: '[SEED] Artículos personales',
      transactionDate: currentMonthDate(17),
    },
    {
      accountId: checking.id,
      categoryId: null,
      transactionType: TRANSACTION_TYPES.TRANSFER_OUT,
      amount: decimal('300.00'),
      description: '[SEED] Transferencia a ahorro',
      transactionDate: currentMonthDate(18),
      transferGroupId,
    },
    {
      accountId: savings.id,
      categoryId: null,
      transactionType: TRANSACTION_TYPES.TRANSFER_IN,
      amount: decimal('300.00'),
      description: '[SEED] Transferencia desde cuenta corriente',
      transactionDate: currentMonthDate(18),
      transferGroupId,
    },
    {
      accountId: creditCard.id,
      categoryId: categories.get('Alimentación').id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('64.80'),
      description: '[SEED] Compra pendiente',
      transactionDate: currentMonthDate(19),
      status: TRANSACTION_STATUS.PENDING,
    },
    {
      accountId: checking.id,
      categoryId: categories.get('Reembolso').id,
      transactionType: TRANSACTION_TYPES.INCOME,
      amount: decimal('40.00'),
      description: '[SEED] Reembolso recibido',
      transactionDate: currentMonthDate(20),
    },
  ];

  await prisma.transaction.createMany({
    data: transactions.map((transaction) => ({
      householdId,
      createdBy: userId,
      status: TRANSACTION_STATUS.CONFIRMED,
      notes: null,
      transferGroupId: null,
      ...transaction,
    })),
  });
}

async function main() {
  const user = await seedUser();
  const household = await seedHousehold(user.id);
  const accounts = await seedAccounts(household.id);
  const categories = await seedCategories(household.id);

  await seedBudgets(household.id, categories);
  await seedTransactions(household.id, user.id, accounts, categories);

  console.log('Seed de desarrollo completado.');
  console.log(`Usuario: ${developmentUser.email}`);
  console.log('La contraseña aún no es utilizable; autenticación se implementará en otra fase.');
}

main()
  .catch((error) => {
    console.error('No se pudo ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
