import { env } from './env.js';

function serializeError(error) {
  return {
    name: error.name,
    message: error.message,
    ...(env.isProduction ? {} : { stack: error.stack }),
  };
}

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  return value;
}

function write(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const serializedEntry = JSON.stringify(entry, jsonReplacer);

  if (level === 'error') {
    console.error(serializedEntry);
    return;
  }

  if (level === 'warn') {
    console.warn(serializedEntry);
    return;
  }

  console.log(serializedEntry);
}

export const logger = Object.freeze({
  info(message, context) {
    write('info', message, context);
  },
  warn(message, context) {
    write('warn', message, context);
  },
  error(message, context) {
    write('error', message, context);
  },
});
