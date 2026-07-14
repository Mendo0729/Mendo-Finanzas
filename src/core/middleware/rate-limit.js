import { RateLimitError } from '../errors/app-error.js';

const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_CLEANUP_INTERVAL = 100;
const MAX_KEY_LENGTH = 512;

export class MemoryRateLimitStore {
  constructor({
    now = () => Date.now(),
    maxEntries = DEFAULT_MAX_ENTRIES,
    cleanupInterval = DEFAULT_CLEANUP_INTERVAL,
  } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new TypeError('maxEntries debe ser un entero positivo.');
    }
    if (!Number.isInteger(cleanupInterval) || cleanupInterval <= 0) {
      throw new TypeError('cleanupInterval debe ser un entero positivo.');
    }

    this.entries = new Map();
    this.now = now;
    this.maxEntries = maxEntries;
    this.cleanupInterval = cleanupInterval;
    this.operations = 0;
  }

  pruneExpired(now = this.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  evictOldest() {
    const oldestKey = this.entries.keys().next().value;
    if (oldestKey !== undefined) {
      this.entries.delete(oldestKey);
    }
  }

  consume(key, windowMs) {
    const now = this.now();
    this.operations += 1;

    if (this.operations % this.cleanupInterval === 0 || this.entries.size >= this.maxEntries) {
      this.pruneExpired(now);
    }

    const existing = this.entries.get(key);
    if (!existing || existing.resetAt <= now) {
      if (existing) {
        this.entries.delete(key);
      }
      while (this.entries.size >= this.maxEntries) {
        this.evictOldest();
      }

      const entry = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, entry);
      return entry;
    }

    existing.count += 1;
    return existing;
  }

  reset() {
    this.entries.clear();
    this.operations = 0;
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

  return async function rateLimitMiddleware(request, response, next) {
    try {
      const generatedKey = keyGenerator(request);
      const key = String(generatedKey ?? request.ip ?? 'unknown').slice(0, MAX_KEY_LENGTH);
      const entry = await store.consume(key, windowMs);
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
    } catch (error) {
      next(error);
    }
  };
}
