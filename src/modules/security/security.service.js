import { AuthenticationError, ConflictError } from '../../core/errors/app-error.js';
import {
  buildOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from '../../core/security/mfa.js';
import * as securityRepository from './security.repository.js';

function parseUserId(value) {
  try {
    return BigInt(value);
  } catch {
    throw new AuthenticationError();
  }
}

function setupResponse(secret, email) {
  return {
    secret,
    otpauthUri: buildOtpAuthUri({ secret, email }),
  };
}

export async function getMfaStatus(rawUserId) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);

  return {
    enabled: Boolean(mfa?.enabled),
    enabledAt: mfa?.enabledAt ?? null,
    lastVerifiedAt: mfa?.lastVerifiedAt ?? null,
  };
}

export async function beginMfaSetup(rawUserId, email) {
  const userId = parseUserId(rawUserId);
  const existing = await securityRepository.findMfaByUserId(userId);

  if (existing?.enabled) {
    throw new ConflictError('La autenticación en dos pasos ya está habilitada.', {
      code: 'MFA_ALREADY_ENABLED',
    });
  }

  const secret = generateTotpSecret();
  await securityRepository.savePendingMfaSecret(userId, encryptTotpSecret(secret));
  return setupResponse(secret, email);
}

export async function getPendingMfaSetup(rawUserId, email) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);

  if (!mfa?.totpSecretEncrypted || mfa.enabled) {
    throw new ConflictError('No existe una configuración MFA pendiente.', {
      code: 'MFA_SETUP_NOT_PENDING',
    });
  }

  return setupResponse(decryptTotpSecret(mfa.totpSecretEncrypted), email);
}

export async function confirmMfaSetup(rawUserId, token) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);

  if (!mfa?.totpSecretEncrypted || mfa.enabled) {
    throw new ConflictError('No existe una configuración MFA pendiente.', {
      code: 'MFA_SETUP_NOT_PENDING',
    });
  }

  const secret = decryptTotpSecret(mfa.totpSecretEncrypted);
  if (!verifyTotp(secret, token)) {
    throw new AuthenticationError('El código de autenticación no es válido.', {
      code: 'INVALID_MFA_CODE',
    });
  }

  const recoveryCodes = generateRecoveryCodes(10);
  await securityRepository.enableMfa(userId, recoveryCodes.map(hashRecoveryCode));
  return recoveryCodes;
}
