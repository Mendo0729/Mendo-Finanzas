import { prisma } from '../../config/database.js';

export function listMembershipsForUser(userId) {
  return prisma.householdMember.findMany({
    where: { userId },
    include: { household: true },
    orderBy: [{ joinedAt: 'asc' }, { householdId: 'asc' }],
  });
}

export function findMembershipForUser(userId, householdId) {
  return prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId,
      },
    },
    include: { household: true },
  });
}
