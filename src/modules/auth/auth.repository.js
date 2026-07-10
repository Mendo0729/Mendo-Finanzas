import { prisma } from '../../config/database.js';

const USER_STATUS_ACTIVE = 1;

export function findUserByEmail(email, client = prisma) {
  return client.user.findUnique({ where: { email } });
}

export function findActiveUserById(userId, client = prisma) {
  return client.user.findFirst({
    where: {
      id: userId,
      status: USER_STATUS_ACTIVE,
    },
  });
}

export function createUser({ name, email, passwordHash }, client = prisma) {
  return client.user.create({
    data: {
      name,
      email,
      passwordHash,
      status: USER_STATUS_ACTIVE,
    },
  });
}

export function updateLastLogin(userId, client = prisma) {
  return client.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}
