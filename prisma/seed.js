import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_STATUS_ACTIVE = 1;
const ROLE_OWNER = 1;
const SEED_PREFIX = '[SEED]';
const SEED_TRANSFER_GROUP_ID = '11111111-1111-4111-8111-111111111111';

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

function buildTransactionDefinitions(accounts, categories) {
  const checking = accounts.get('Cuenta corriente');
  const savings = accounts.get('Cuenta de ahorro');
  const creditCard = accounts.get('Tarjeta Visa');

  return [
    ['Cuenta corriente', 'Salario', 1, '1850.00', 'Salario mensual', 1],
    ['Cuenta corriente', 'Trabajo adicional', 1, '250.00', 'Trabajo independiente', 3],
    ['Tarjeta Visa', 'Alimentación', 2, '86.42', 'Supermercado', 4],
    ['Cuenta corriente', 'Vivienda', 2, '650.00', 'Alquiler', 5],
    ['Billetera digital', 'Transporte', 2, '18.50', 'Transporte', 6],
    ['Cuenta corriente', 'Servicios', 2, '45.00', 'Internet', 7],
    ['Tarjeta Visa', 'Salud', 2, '32.75', 'Farmacia', 8],
    ['Tarjeta Visa', 'Educación', 2, '24.99', 'Curso en línea', 9],
    ['Efectivo', 'Entretenimiento', 2, '22.00', 'Cine', 10],
    ['Tarjeta Visa', 'Compras', 2, '58.30', 'Compra para el hogar', 11],
    ['Cuenta corriente', 'Deudas', 2, '125.00', 'Pago de préstamo', 12],
    ['Tarjeta Visa', 'Suscripciones', 2, '15.99', 'Suscripción mensual', 13],
    ['Tarjeta Visa', 'Alimentación', 2, '42.15', 'Restaurante', 14],
    ['Billetera digital', 'Transporte', 2, '12.25', 'Viaje local', 15],
    ['Cuenta corriente', 'Servicios', 2, '37.60', 'Electricidad', 16],
    ['Efectivo', 'Compras', 2, '19.90', 'Artículos personales', 17],
  ]
    .map(([accountName, categoryName, transactionType, amount, description, day]) => ({
      accountId: accounts.get(accountName).id,
      categoryId: categories.get(categoryName).id,
      transactionType,
      amount: decimal(amount),
      description: `${SEED_PREFIX} ${description}`,
      transactionDate: currentMonthDate(day),
      status: TRANSACTION_STATUS.CONFIRMED,
      transferGroupId: null,
    }))
    .concat([
      {
        accountId: checking.id,
        categoryId: null,
        transactionType: TRANSACTION_TYPES.TRANSFER_OUT,
        amount: decimal('300.00'),
        description: `${SEED_PREFIX} Transferencia a ahorro`,
        transactionDate: currentMonthDate(18),
        status: TRANSACTION_STATUS.CONFIRMED,
        transferGroupId: SEED_TRANSFER_GROUP_ID,
      },
      {
        accountId: savings.id,
        categoryId: null,
        transactionType: TRANSACTION_TYPES.TRANSFER_IN,
        amount: decimal('300.00'),
        description: `${SEED_PREFIX} Transferencia desde cuenta corriente`,
        transactionDate: currentMonthDate(18),
        status: TRANSACTION_STATUS.CONFIRMED,
        transferGroupId: SEED_TRANSFER_GROUP_ID,
      },
      {
        accountId: creditCard.id,
        categoryId: categories.get('Alimentación').id,
        transactionType: TRANSACTION_TYPES.EXPENSE,
        amount: decimal('64.80'),
        description: `${SEED_PREFIX} Compra pendiente`,
        transactionDate: currentMonthDate(19),
        status: TRANSACTION_STATUS.PENDING,
        transferGroupId: null,
      },
      {
        accountId: checking.id,
        categoryId: categories.get('Reembolso').id,
        transactionType: TRANSACTION_TYPES.INCOME,
        amount: decimal('40.00'),
        description: `${SEED_PREFIX} Reembolso recibido`,
        transactionDate: currentMonthDate(20),
        status: TRANSACTION_STATUS.CONFIRMED,
        transferGroupId: null,
      },
    ]);
}

async function seedTransactions(householdId, userId, accounts, categories) {
  const definitions = buildTransactionDefinitions(accounts, categories);
  const expectedDescriptions = new Set(definitions.map(({ description }) => description));
  const existingTransactions = await prisma.transaction.findMany({
    where: {
      householdId,
      description: { startsWith: SEED_PREFIX },
    },
    orderBy: { id: 'asc' },
  });
  const existingByDescription = new Map();

  for (const transaction of existingTransactions) {
    const matches = existingByDescription.get(transaction.description) ?? [];
    matches.push(transaction);
    existingByDescription.set(transaction.description, matches);
  }

  await prisma.$transaction(async (database) => {
    for (const definition of definitions) {
      const matches = existingByDescription.get(definition.description) ?? [];
      const [existing, ...duplicates] = matches;
      const data = {
        householdId,
        createdBy: userId,
        notes: null,
        deletedAt: null,
        ...definition,
      };

      if (existing) {
        await database.transaction.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await database.transaction.create({ data });
      }

      if (duplicates.length > 0) {
        await database.transaction.updateMany({
          where: { id: { in: duplicates.map(({ id }) => id) } },
          data: { deletedAt: new Date() },
        });
      }
    }

    const staleIds = existingTransactions
      .filter(({ description }) => !expectedDescriptions.has(description))
      .map(({ id }) => id);

    if (staleIds.length > 0) {
      await database.transaction.updateMany({
        where: { id: { in: staleIds } },
        data: { deletedAt: new Date() },
      });
    }
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
