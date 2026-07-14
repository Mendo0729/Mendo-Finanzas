import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import { sendEmailVerification } from '../../core/email/email.service.js';
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from '../../core/errors/app-error.js';
import {
  consumePasswordVerificationTime,
  hashPassword,
  verifyPassword,
} from '../../core/security/password.js';
import * as authRepository from './auth.repository.js';

const USER_STATUS_ACTIVE = 1;
const EMAIL_VERIFICATION_TOKEN_TYPE = 1;
const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const EMAIL_VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export function hashEmailVerificationToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createEmailVerificationToken(now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    issuedAt: now,
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
  };
}

function buildVerificationUrl(token) {
  const verificationUrl = new URL('/auth/verify-email', env.appUrl);
  verificationUrl.searchParams.set('token', token);
  return verificationUrl.toString();
}

async function deliverVerificationEmail(email, token) {
  await sendEmailVerification({
    recipient: email,
    verificationUrl: buildVerificationUrl(token),
  });
}

export async function registerUser({ name, email, password }) {
  const passwordHash = await hashPassword(password);
  const verification = createEmailVerificationToken();

  try {
    const user = await authRepository.createUserWithVerificationToken({
      name,
      email,
      passwordHash,
      tokenType: EMAIL_VERIFICATION_TOKEN_TYPE,
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
    });

    await deliverVerificationEmail(user.email, verification.token);
    return publicUser(user);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('Ya existe una cuenta registrada con ese correo.', {
        code: 'EMAIL_ALREADY_REGISTERED',
        cause: error,
      });
    }

    throw error;
  }
}

export async function resendEmailVerification(email) {
  const user = await authRepository.findUserByEmail(email);
  if (!user || user.status !== USER_STATUS_ACTIVE || user.emailVerifiedAt) {
    return false;
  }

  const verification = createEmailVerificationToken();
  await authRepository.replaceEmailVerificationToken({
    userId: user.id,
    tokenType: EMAIL_VERIFICATION_TOKEN_TYPE,
    tokenHash: verification.tokenHash,
    expiresAt: verification.expiresAt,
    issuedAt: verification.issuedAt,
  });
  await deliverVerificationEmail(user.email, verification.token);
  return true;
}

export async function verifyEmail(token) {
  if (
    typeof token !== 'string' ||
    !EMAIL_VERIFICATION_TOKEN_PATTERN.test(token) ||
    token.length > 100
  ) {
    throw new ValidationError('El enlace de verificación no es válido o ya expiró.', {
      code: 'EMAIL_VERIFICATION_INVALID',
    });
  }

  const user = await authRepository.consumeEmailVerificationToken({
    tokenHash: hashEmailVerificationToken(token),
    tokenType: EMAIL_VERIFICATION_TOKEN_TYPE,
    verifiedAt: new Date(),
  });

  if (!user) {
    throw new ValidationError('El enlace de verificación no es válido o ya expiró.', {
      code: 'EMAIL_VERIFICATION_INVALID',
    });
  }

  return publicUser(user);
}

export async function authenticateUser({ email, password }) {
  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    await consumePasswordVerificationTime(password);
    throw new AuthenticationError('Correo o contraseña incorrectos.', {
      code: 'INVALID_CREDENTIALS',
    });
  }

  const passwordMatches = await verifyPassword(user.passwordHash, password);

  if (!passwordMatches || user.status !== USER_STATUS_ACTIVE) {
    throw new AuthenticationError('Correo o contraseña incorrectos.', {
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (!user.emailVerifiedAt) {
    throw new AuthenticationError('Debes verificar tu correo antes de iniciar sesión.', {
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  return {
    ...publicUser(user),
    mfaEnabled: Boolean(user.mfa?.enabled),
  };
}

export async function completeAuthenticatedLogin(userId) {
  const user = await authRepository.updateLastLogin(BigInt(userId));
  return publicUser(user);
}
