// scripts/seed_test_user.js — One-time test user creation
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Test1234!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'test@aic.com' },
    update: { passwordHash: hash },
    create: { clientId: 2, email: 'test@aic.com', displayName: 'Test User', jobTitle: 'Reviewer', passwordHash: hash }
  });

  // Assign invoice_reviewer role
  const role = await prisma.role.findUnique({ where: { code: 'invoice_reviewer' } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId_clientId: { userId: user.id, roleId: role.id, clientId: 2 } },
      update: {},
      create: { userId: user.id, roleId: role.id, clientId: 2 }
    });
  }

  // Also assign system_admin
  const adminRole = await prisma.role.findUnique({ where: { code: 'system_admin' } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId_clientId: { userId: user.id, roleId: adminRole.id, clientId: 2 } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id, clientId: 2 }
    });
  }

  // Also assign finance_approver
  const faRole = await prisma.role.findUnique({ where: { code: 'finance_approver' } });
  if (faRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId_clientId: { userId: user.id, roleId: faRole.id, clientId: 2 } },
      update: {},
      create: { userId: user.id, roleId: faRole.id, clientId: 2 }
    });
  }

  console.log('Test user created:', user.id, user.email);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
