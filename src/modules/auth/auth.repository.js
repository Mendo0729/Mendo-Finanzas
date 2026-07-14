import { prisma } from '../../config/database.js';

const USER_STATUS_ACTIVE = 1;

export function findUserByEmail(email, client = prisma) {
  return client.user.findUnique({
    where: { email },
    include: { mfa: true },
  });
}

export function findActiveUserById(userId, client = prisma) {
  return client.user.findFirst({
    where: {
      id: userId,
      status: USER_STATUS_ACTIVE,
    },
  });
}

export function createUserWithVerificationToken(
  { name, email, passwordHash, tokenType, tokenHash, expiresAt },
  database = prisma,
) {
  return database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name,
        email,
        passwordHash,
        status: USER_STATUS_ACTIVE,
      },
    });

    await transaction.authToken.create({
      data: {
        userId: user.id,
        tokenType,
        tokenHash,
        expiresAt,
      },
    });

    return user;
  });
}

export function replaceEmailVerificationToken(
  { userId, tokenType, tokenHash, expiresAt, issuedAt },
  database = prisma,
) {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;

    await transaction.authToken.updateMany({
      where: {
        userId,
        tokenType,
        usedAt: null,
      },
      data: { usedAt: issuedAt },
    });

    return transaction.authToken.create({
      data: {
        userId,
        tokenType,
        tokenHash,
        expiresAt,
      },
    });
  });
}

export function consumeEmailVerificationToken(
  { tokenHash, tokenType, verifiedAt },
  database = prisma,
) {
  return database.$transaction(async (transaction) => {
    const token = await transaction.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !token ||
      token.tokenType !== tokenType ||
      token.usedAt ||
      token.expiresAt <= verifiedAt ||
      token.user.status !== USER_STATUS_ACTIVE
    ) {
      return null;
    }

    const consumed = await transaction.authToken.updateMany({
      where: {
        id: token.id,
        usedAt: null,
        expiresAt: { gt: verifiedAt },
      },
      data: { usedAt: verifiedAt },
    });

    if (consumed.count !== 1) {
      return null;
    }

    const user = await transaction.user.update({
      where: { id: token.userId },
      data: {
        emailVerifiedAt: token.user.emailVerifiedAt ?? verifiedAt,
      },
    });

    await transaction.authToken.updateMany({
      where: {
        userId: token.userId,
        tokenType,
        usedAt: null,
      },
      data: { usedAt: verifiedAt },
    });

    return user;
  });
}

export function updateLastLogin(userId, client = prisma) {
  return client.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}
