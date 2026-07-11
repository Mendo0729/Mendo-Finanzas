import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_EMAIL = 'demo@mendofinanzas.local';
const DEMO_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$bWVuZG8tZGVtby0yMDI2IQ$aQee7/0V9AWfD11OuH8IncRNp6vF/Sdblq4RYmK48Kg';

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: DEMO_EMAIL },
    data: { passwordHash: DEMO_PASSWORD_HASH },
  });

  if (result.count !== 1) {
    throw new Error(`No se encontró el usuario de desarrollo ${DEMO_EMAIL}.`);
  }

  console.log('Contraseña del usuario de desarrollo preparada para pruebas locales.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
