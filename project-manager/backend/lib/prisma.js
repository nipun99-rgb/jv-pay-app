const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'error' }],
});

prisma.$on('error', (e) => {
  console.error('Prisma error:', e.message);
});

module.exports = prisma;
