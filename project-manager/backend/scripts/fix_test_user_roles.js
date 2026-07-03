// scripts/fix_test_user_roles.js — Assign roles to test user using actual role IDs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 2; // test@aic.com
  const clientId = 2;
  
  // Get all roles
  const roles = await prisma.role.findMany();
  console.log('Available roles:', roles.map(r => `${r.id}:${r.code}`));
  
  // Assign ADMIN (1), REVIEWER (2), APPROVER (3) to user
  for (const roleId of [1, 2, 3]) {
    await prisma.userRole.upsert({
      where: { userId_roleId_clientId: { userId, roleId, clientId } },
      update: {},
      create: { userId, roleId, clientId }
    });
    console.log(`Assigned role ${roleId} to user ${userId}`);
  }
  
  // Verify
  const assigned = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } }
  });
  console.log('User roles:', assigned.map(ur => ur.role.code));
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
