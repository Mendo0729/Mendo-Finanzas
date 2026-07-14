const allowedEnvironments = new Set(['development', 'test']);
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!allowedEnvironments.has(nodeEnv)) {
  throw new Error('El seed solo puede ejecutarse en entornos development o test.');
}

await import('./seed.js');
