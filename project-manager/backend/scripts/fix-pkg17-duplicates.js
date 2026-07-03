/**
 * fix-pkg17-duplicates.js
 * Removes duplicate SubPayApplicationHeader rows for package 17.
 * Keeps the lowest id for each (subcontractorName, startPage, endPage) combination
 * and deletes all higher-id duplicates (and their child SOV lines).
 *
 * Run: node scripts/fix-pkg17-duplicates.js
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const prisma = require('../lib/prisma');

async function main() {
  const PACKAGE_ID = 17;

  // Load all headers for this package
  const all = await prisma.subPayApplicationHeader.findMany({
    where: { packageId: PACKAGE_ID },
    orderBy: { id: 'asc' }
  });

  console.log(`Total sub-headers: ${all.length}`);

  // Group by a dedup key: subcontractorName + startPage + endPage
  const seen = new Map(); // key -> first (lowest) id kept
  const toDelete = [];

  for (const h of all) {
    const key = `${(h.subcontractorName || '').trim().toLowerCase()}|${h.startPage ?? ''}|${h.endPage ?? ''}`;
    if (seen.has(key)) {
      toDelete.push(h.id);
    } else {
      seen.set(key, h.id);
    }
  }

  console.log(`Duplicate ids to delete (${toDelete.length}):`, toDelete);

  if (toDelete.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  // Delete child SOV lines first (FK constraint)
  const sovDel = await prisma.subPayApplicationSovLine.deleteMany({
    where: { subAppId: { in: toDelete } }
  });
  console.log(`Deleted ${sovDel.count} orphan SOV lines`);

  // Delete duplicate headers
  const hDel = await prisma.subPayApplicationHeader.deleteMany({
    where: { id: { in: toDelete } }
  });
  console.log(`Deleted ${hDel.count} duplicate headers`);

  // Final count
  const remaining = await prisma.subPayApplicationHeader.count({ where: { packageId: PACKAGE_ID } });
  console.log(`Remaining sub-headers: ${remaining}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
