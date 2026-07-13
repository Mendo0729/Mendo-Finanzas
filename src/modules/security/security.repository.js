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
