import { app } from './app.js';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const server = app.listen(env.port, () => {
  logger.info('Mendo Finanzas inició correctamente.', {
    appUrl: env.appUrl,
    environment: env.nodeEnv,
  });
});

let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Cierre ordenado iniciado.', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Cierre forzado después de exceder el tiempo límite.', { signal });
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(exitCode);
    } catch (error) {
      logger.error('No se pudo cerrar Prisma correctamente.', { error });
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error('Excepción no controlada.', { error });
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada sin manejo.', { reason });
  shutdown('unhandledRejection', 1);
});
