import { RateLimitError } from '../errors/app-error.js';

export class MemoryRateLimitStore {
  constructor({ now = () => Date.now() } = {}) {
    this.entries = new Map();
    this.now = now;
  }

  consume(key, windowMs) {
    const now = this.now();
    const existing = this.entries.get(key);

    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, entry);
      return entry;
    }

    existing.count += 1;
    return existing;
  }

  reset() {
    this.entries.clear();
  }
}

export function createRateLimiter({
  windowMs,
  limit,
  keyGenerator = (request) => request.ip,
  message = 'Demasiados intentos. Espera antes de volver a intentarlo.',
  store = new MemoryRateLimitStore(),
}) {
  if (!Number.isInteger(windowMs) || windowMs <= 0 || !Number.isInteger(limit) || limit <= 0) {
    throw new TypeError('windowMs y limit deben ser enteros positivos.');
  }

  return function rateLimitMiddleware(request, response, next) {
    const key = keyGenerator(request);
    const entry = store.consume(key, windowMs);
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));

    response.setHeader('RateLimit-Limit', String(limit));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));

    if (entry.count > limit) {
      response.setHeader('Retry-After', String(resetSeconds));
      next(new RateLimitError(message));
      return;
    }

    next();
  };
}
