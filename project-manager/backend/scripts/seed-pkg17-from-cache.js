/**
 * seed-pkg17-from-cache.js
 * Seeds SubPayApplicationHeader + SubPayApplicationSovLine for package 17
 * from the existing payapp12_extract_cache.json notebook cache.
 * 
 * Run: node scripts/seed-pkg17-from-cache.js
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const PACKAGE_ID = 17;
const CACHE_FILE = path.join(__dirname, '../../../data/app12/payapp12_extract_cache.json');

function toF(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

async function main() {
  // Verify cache exists
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`Cache not found: ${CACHE_FILE}`);
  }

  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const records = raw.data || raw; // handle both {data:[]} and [] formats
  console.log(`Cache records: ${records.length}`);

  // Wipe existing data for clean state
  await prisma.subPayApplicationSovLine.deleteMany({ where: { packageId: PACKAGE_ID } });
  await prisma.subPayApplicationHeader.deleteMany({ where: { packageId: PACKAGE_ID } });
  console.log('Cleared existing sub data');

  // Get agent plan items for linking
  const plan = await prisma.agentPlan.findFirst({
    where: { packageId: PACKAGE_ID },
    include: { items: true }
  });

  let headersCreated = 0;
  let sovLinesCreated = 0;

  for (const rec of records) {
    const h = rec.header || {};
    const subName = h.subcontractor_name || rec._subcontractor || '';

    // Find matching agent plan item
    const planItem = plan?.items.find(i =>
      i.subcontractorName.toUpperCase() === subName.toUpperCase() ||
      subName.toUpperCase().includes(i.subcontractorName.toUpperCase()) ||
      i.subcontractorName.toUpperCase().includes(subName.toUpperCase())
    );

    const subHeader = await prisma.subPayApplicationHeader.create({
      data: {
        packageId: PACKAGE_ID,
        agentPlanItemId: planItem?.id || null,
        seqId: rec._group_idx || null,
        subcontractorName: subName,
        applicationNo: h.invoice_application_no || rec._app_ref || null,
        applicationDate: h.invoice_date || null,
        periodFrom: h.period_from || null,
        periodTo: h.period_to || null,
        invoiceTo: h.invoice_to || null,
        projectNameOnDoc: h.project_name || null,
        contractPoNumber: h.contract_po_number || null,
        startPage: rec._start_page || null,
        endPage: rec._end_page || null,
        documentType: 'AIA G702',
        originalContractSum: toF(h.original_contract_sum),
        netChangeOrders: toF(h.net_change_by_change_orders),
        contractSumToDate: toF(h.contract_sum_to_date),
        totalCompletedStored: toF(h.total_completed_stored_to_date),
        completedWorkThisPeriod: toF(h.completed_work_this_period) ?? toF(h.current_payment_due_this_period),
        totalRetainage: toF(h.total_retainage),
        retainagePercent: toF(h.retainage_percent || h.retainage_pct),
        totalEarnedLessRetainage: toF(h.total_earned_less_retainage),
        lessPrevCertificates: toF(h.less_previous_certificates_payments),
        currentPaymentDue: toF(h.current_payment_due_this_period),
        balanceToFinish: toF(h.balance_to_finish),
        additionalSupportingDocs: h.supporting_document || h.additional_supporting_documents || null,
        validationStatus: 'unchecked'
      }
    });
    headersCreated++;

    // Seed SOV lines
    const sovLines = rec.line_items || rec.sov_lines || [];
    for (const line of sovLines) {
      await prisma.subPayApplicationSovLine.create({
        data: {
          packageId: PACKAGE_ID,
          subAppId: subHeader.id,
          sourcePage: parseInt(line.page_number || line.source_page) || null,
          itemNo: String(line.item_no || '').trim() || null,
          description: line.description_of_work || line.description || null,
          scheduledValue: toF(line.scheduled_value),
          workCompletedPrev: toF(line.work_completed_previous || line.previous_completed),
          workCompletedThis: toF(line.work_completed_this_period || line.work_completed_this),
          materialsStored: toF(line.materials_stored),
          totalCompleted: toF(line.total_completed_and_stored || line.total_completed),
          pctComplete: toF(line.percent_complete || line.pct_complete),
          retainage: toF(line.retainage),
          balanceToFinish: toF(line.balance_to_finish),
          validationStatus: 'unchecked'
        }
      });
      sovLinesCreated++;
    }
  }

  console.log(`Created ${headersCreated} sub-headers`);
  console.log(`Created ${sovLinesCreated} SOV lines`);

  // Verify
  const finalHeaders = await prisma.subPayApplicationHeader.count({ where: { packageId: PACKAGE_ID } });
  const finalSov = await prisma.subPayApplicationSovLine.count({ where: { packageId: PACKAGE_ID } });
  console.log(`\nFinal DB state: ${finalHeaders} headers, ${finalSov} SOV lines`);
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
