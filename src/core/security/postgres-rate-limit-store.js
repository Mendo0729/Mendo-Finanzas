import { createHash } from 'node:crypto';

import { prisma } from '../../config/database.js';

const DEFAULT_CLEANUP_INTERVAL = 500;
const SCOPE_PATTERN = /^[a-z0-9._-]{1,80}$/;

export function hashRateLimitKey(key) {
  return createHash('sha256').update(String(key)).digest('hex');
}

export class PostgresRateLimitStore {
  constructor({
    database = prisma,
    scope,
    cleanupInterval = DEFAULT_CLEANUP_INTERVAL,
  } = {}) {
    if (!SCOPE_PATTERN.test(scope ?? '')) {
      throw new TypeError('scope debe contener entre 1 y 80 caracteres seguros.');
    }
    if (!Number.isInteger(cleanupInterval) || cleanupInterval <= 0) {
      throw new TypeError('cleanupInterval debe ser un entero positivo.');
    }

    this.database = database;
    this.scope = scope;
    this.cleanupInterval = cleanupInterval;
    this.operations = 0;
  }

  async consume(key, windowMs) {
    this.operations += 1;
    const keyHash = hashRateLimitKey(key);
    const [entry] = await this.database.$queryRaw`
      INSERT INTO "rate_limit_buckets" (
        "scope",
        "key_hash",
        "attempts",
        "reset_at",
        "updated_at"
      )
      VALUES (
        ${this.scope},
        ${keyHash},
        1,
        CURRENT_TIMESTAMP + make_interval(secs => ${windowMs} / 1000.0),
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("scope", "key_hash") DO UPDATE
      SET
        "attempts" = CASE
          WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN 1
          ELSE "rate_limit_buckets"."attempts" + 1
        END,
        "reset_at" = CASE
          WHEN "rate_limit_buckets"."reset_at" <= CURRENT_TIMESTAMP THEN EXCLUDED."reset_at"
          ELSE "rate_limit_buckets"."reset_at"
        END,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "attempts", "reset_at" AS "resetAt"
    `;

    if (this.operations % this.cleanupInterval === 0) {
      await this.pruneExpired();
    }

    return {
      count: entry.attempts,
      resetAt: entry.resetAt.getTime(),
    };
  }

  async pruneExpired(now = new Date()) {
    return this.database.rateLimitBucket.deleteMany({
      where: { resetAt: { lte: now } },
    });
  }

  async reset() {
    this.operations = 0;
    return this.database.rateLimitBucket.deleteMany({
      where: { scope: this.scope },
    });
  }
}
