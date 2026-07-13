import QRCode from 'qrcode-svg';

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
import { verifyPassword } from '../../core/security/password.js';
import * as securityRepository from './security.repository.js';

function parseUserId(value) {
  try {
    return BigInt(value);
  } catch {
    throw new AuthenticationError();
  }
}

function createQrSvg(otpauthUri) {
  return new QRCode({
    content: otpauthUri,
    padding: 4,
    width: 256,
    height: 256,
    color: '#000000',
    background: '#ffffff',
    ecl: 'M',
    join: true,
    container: 'svg-viewbox',
  }).svg();
}

function setupResponse(secret, email) {
  const otpauthUri = buildOtpAuthUri({ secret, email });
  return {
    secret,
    otpauthUri,
    qrSvg: createQrSvg(otpauthUri),
  };
}

async function requireValidPassword(userId, password) {
  const user = await securityRepository.findUserPasswordHash(userId);
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw new AuthenticationError('La contraseña actual no es válida.', {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }
}

export async function getMfaStatus(rawUserId) {
  const userId = parseUserId(rawUserId);
  const [mfa, unusedRecoveryCodes] = await Promise.all([
    securityRepository.findMfaByUserId(userId),
    securityRepository.countUnusedRecoveryCodes(userId),
  ]);

  return {
    enabled: Boolean(mfa?.enabled),
    enabledAt: mfa?.enabledAt ?? null,
    lastVerifiedAt: mfa?.lastVerifiedAt ?? null,
    unusedRecoveryCodes,
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

export async function disableMfa(rawUserId, password) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);
  if (!mfa?.enabled) {
    throw new ConflictError('La autenticación en dos pasos ya está desactivada.', {
      code: 'MFA_ALREADY_DISABLED',
    });
  }

  await requireValidPassword(userId, password);
  await securityRepository.disableMfa(userId);
}

export async function regenerateRecoveryCodes(rawUserId, password) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);
  if (!mfa?.enabled) {
    throw new ConflictError('Debes habilitar MFA antes de generar códigos de recuperación.', {
      code: 'MFA_NOT_ENABLED',
    });
  }

  await requireValidPassword(userId, password);
  const recoveryCodes = generateRecoveryCodes(10);
  await securityRepository.replaceRecoveryCodes(userId, recoveryCodes.map(hashRecoveryCode));
  return recoveryCodes;
}

export async function verifyMfaLogin(rawUserId, token) {
  const userId = parseUserId(rawUserId);
  const mfa = await securityRepository.findMfaByUserId(userId);

  if (!mfa?.enabled || !mfa.totpSecretEncrypted) {
    throw new AuthenticationError('El desafío MFA ya no es válido.', {
      code: 'MFA_CHALLENGE_INVALID',
    });
  }

  const secret = decryptTotpSecret(mfa.totpSecretEncrypted);
  if (!verifyTotp(secret, token)) {
    throw new AuthenticationError('El código de autenticación no es válido.', {
      code: 'INVALID_MFA_CODE',
    });
  }

  await securityRepository.recordMfaVerification(userId);
}

export async function verifyRecoveryCode(rawUserId, recoveryCode) {
  const userId = parseUserId(rawUserId);
  const consumed = await securityRepository.consumeRecoveryCode(
    userId,
    hashRecoveryCode(recoveryCode),
  );

  if (!consumed) {
    throw new AuthenticationError('El código de recuperación no es válido.', {
      code: 'INVALID_RECOVERY_CODE',
    });
  }
}
