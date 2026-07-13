import { prisma } from '../../config/database.js';

export function findMfaByUserId(userId) {
  return prisma.userMfa.findUnique({ where: { userId } });
}

export function savePendingMfaSecret(userId, encryptedSecret) {
  return prisma.userMfa.upsert({
    where: { userId },
    update: {
      enabled: false,
      totpSecretEncrypted: encryptedSecret,
      enabledAt: null,
      lastVerifiedAt: null,
    },
    create: {
      userId,
      enabled: false,
      totpSecretEncrypted: encryptedSecret,
    },
  });
}

export function enableMfa(userId, recoveryCodeHashes) {
  return prisma.$transaction(async (transaction) => {
    const mfa = await transaction.userMfa.update({
      where: { userId },
      data: {
        enabled: true,
        enabledAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });

    await transaction.recoveryCode.deleteMany({ where: { userId } });
    await transaction.recoveryCode.createMany({
      data: recoveryCodeHashes.map((codeHash) => ({ userId, codeHash })),
    });

    return mfa;
  });
}

export function recordMfaVerification(userId) {
  return prisma.userMfa.update({
    where: { userId },
    data: { lastVerifiedAt: new Date() },
  });
}

export function consumeRecoveryCode(userId, codeHash) {
  return prisma.$transaction(async (transaction) => {
    const code = await transaction.recoveryCode.findFirst({
      where: { userId, codeHash, usedAt: null },
    });

    if (!code) return false;

    const updated = await transaction.recoveryCode.updateMany({
      where: { id: code.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (updated.count !== 1) return false;

    await transaction.userMfa.update({
      where: { userId },
      data: { lastVerifiedAt: new Date() },
    });

    return true;
  });
}
