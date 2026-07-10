import { app } from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`Mendo Finanzas disponible en ${env.appUrl}`);
  console.log(`Entorno: ${env.nodeEnv}`);
});

let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log(`${signal} recibido. Cerrando la aplicación...`);

  const forceExitTimer = setTimeout(() => {
    console.error('Cierre forzado después de exceder el tiempo límite.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(exitCode);
    } catch (error) {
      console.error('No se pudo cerrar Prisma correctamente:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  console.error('Excepción no controlada:', error);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada sin manejo:', reason);
  shutdown('unhandledRejection', 1);
});
