import { PrismaClient } from '@prisma/client';

import { env } from './env.js';

const prismaClient =
  globalThis.__mendoFinanzasPrisma ??
  new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (!env.isProduction) {
  globalThis.__mendoFinanzasPrisma = prismaClient;
}

export const prisma = prismaClient;

export async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
