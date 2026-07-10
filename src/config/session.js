import session from 'express-session';

import { prisma } from './database.js';
import { env } from './env.js';

const SESSION_COOKIE_NAME = 'mendo.sid';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function serializeSession(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveExpiration(sessionData, ttlMs) {
  const cookieExpiration = sessionData?.cookie?.expires;

  if (cookieExpiration) {
    const expiration = new Date(cookieExpiration);
    if (!Number.isNaN(expiration.getTime())) {
      return expiration;
    }
  }

  return new Date(Date.now() + ttlMs);
}

export class PrismaSessionStore extends session.Store {
  constructor({ client = prisma, ttlMs = SESSION_TTL_MS } = {}) {
    super();
    this.client = client;
    this.ttlMs = ttlMs;
  }

  get(sessionId, callback) {
    this.client.session
      .findUnique({ where: { sid: sessionId } })
      .then(async (record) => {
        if (!record) {
          callback(null, null);
          return;
        }

        if (record.expire <= new Date()) {
          await this.client.session.deleteMany({ where: { sid: sessionId } });
          callback(null, null);
          return;
        }

        callback(null, record.sess);
      })
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expire = resolveExpiration(sessionData, this.ttlMs);

    this.client.session
      .upsert({
        where: { sid: sessionId },
        update: {
          sess: serializeSession(sessionData),
          expire,
        },
        create: {
          sid: sessionId,
          sess: serializeSession(sessionData),
          expire,
        },
      })
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    this.client.session
      .deleteMany({ where: { sid: sessionId } })
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    this.client.session
      .updateMany({
        where: { sid: sessionId },
        data: {
          sess: serializeSession(sessionData),
          expire: resolveExpiration(sessionData, this.ttlMs),
        },
      })
      .then(() => callback(null))
      .catch(callback);
  }

  clear(callback = () => {}) {
    this.client.session
      .deleteMany()
      .then(() => callback(null))
      .catch(callback);
  }

  length(callback) {
    this.client.session
      .count({ where: { expire: { gt: new Date() } } })
      .then((count) => callback(null, count))
      .catch(callback);
  }
}

export function createSessionMiddleware({ store = new PrismaSessionStore() } = {}) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: env.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: env.isProduction,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: SESSION_TTL_MS,
      path: '/',
    },
  });
}

export const sessionCookieName = SESSION_COOKIE_NAME;
