/**
 * Sub-Contractor Extractor — Node.js wrapper for extract_subcontractors.py
 * Invokes the Python script with --ocr azure, parses JSON output,
 * and loads data into Azure SQL.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const prisma = require('../prisma');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const PYTHON = process.env.PYTHON_PATH || 'python';

async function extractSubcontractors(pdfLocalPath, packageId, confirmedSubs, onProgress) {
  const outputJson = path.join(UPLOAD_DIR, `sub_${packageId}.json`);

  // Run Python extractor — ALWAYS with --ocr azure (non-negotiable)
  await new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [
      path.join(__dirname, '../../extract_subcontractors.py'),
      pdfLocalPath,
      outputJson,
      '--ocr', 'azure'
    ], {
      env: { ...process.env }
    });

    proc.stdout.on('data', d => {
      const lines = d.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('PROGRESS:') && onProgress) {
          onProgress(line.replace('PROGRESS:', ''));
        }
      }
    });

    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Sub-contractor extractor exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });

  // Parse output JSON
  if (!fs.existsSync(outputJson)) {
    throw new Error('Sub-contractor extraction produced no output');
  }

  const rawData = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));

  // Get agent plan for linking
  const agentPlan = await prisma.agentPlan.findFirst({
    where: { packageId },
    include: { items: true }
  });

  // Process each sub-contractor
  for (const sub of rawData) {
    const subName = sub.company || sub.subcontractor_name || '';

    // Filter: only process confirmed subs
    const isConfirmed = confirmedSubs.some(cs =>
      cs.toUpperCase() === subName.toUpperCase() ||
      subName.toUpperCase().includes(cs.toUpperCase()) ||
      cs.toUpperCase().includes(subName.toUpperCase())
    );
    if (!isConfirmed && confirmedSubs.length > 0) continue;

    // Find matching agent plan item
    const planItem = agentPlan?.items.find(i =>
      i.subcontractorName.toUpperCase() === subName.toUpperCase() ||
      subName.toUpperCase().includes(i.subcontractorName.toUpperCase())
    );

    if (onProgress) {
      onProgress(`Extracting ${subName}...`);
    }

    // Create sub pay application header
    const subHeader = await prisma.subPayApplicationHeader.create({
      data: {
        packageId,
        agentPlanItemId: planItem?.id || null,
        subcontractorName: subName,
        applicationNo: sub.application_no || sub.app_number || null,
        periodTo: sub.period_to || null,
        startPage: sub.start_page || null,
        endPage: sub.end_page || null,
        documentType: sub.document_type || 'G702_G703',
        originalContractSum: parseFloat(sub.original_contract_sum) || null,
        netChangeOrders: parseFloat(sub.net_change_orders) || null,
        contractSumToDate: parseFloat(sub.contract_sum_to_date) || null,
        totalCompletedStored: parseFloat(sub.total_completed_stored) || null,
        completedWorkThisPeriod: parseFloat(sub.completed_work_this_period || sub.net_amount) || null,
        totalRetainage: parseFloat(sub.total_retainage) || null,
        retainagePercent: parseFloat(sub.retainage_pct || sub.retainage_percent) || null,
        totalEarnedLessRetainage: parseFloat(sub.total_earned_less_retainage) || null,
        lessPrevCertificates: parseFloat(sub.less_prev_certificates) || null,
        currentPaymentDue: parseFloat(sub.current_payment_due) || null,
        balanceToFinish: parseFloat(sub.balance_to_finish) || null,
        // G703 continuation sheet grand totals
        g703ScheduledValue: parseFloat(sub.g703_scheduled_value) || null,
        g703WorkPrev: parseFloat(sub.g703_work_prev) || null,
        g703WorkThisPeriod: parseFloat(sub.g703_work_this_period) || null,
        g703MaterialsStored: parseFloat(sub.g703_materials_stored) || null,
        g703TotalCompleted: parseFloat(sub.g703_total_completed) || null,
        g703Retainage: parseFloat(sub.g703_retainage) || null,
        g703EarnedLessRet: parseFloat(sub.g703_earned_less_ret) || null,
        g703BalanceToFinish: parseFloat(sub.g703_balance_to_finish) || null,
        reconFlag: sub.recon_flag || null,
        contractorSignature: sub.contractor_signature || null,
        architectSignature: sub.architect_signature || null,
        notarized: sub.notarized || null,
        additionalSupportingDocs: sub.additional_supporting_docs || null,
        extractionConfidence: parseFloat(sub.confidence) || null,
        validationStatus: 'unchecked'
      }
    });

    // Create SOV lines if present
    const sovLines = sub.sov_lines || sub.line_items || [];
    for (const line of sovLines) {
      await prisma.subPayApplicationSovLine.create({
        data: {
          packageId,
          subAppId: subHeader.id,
          sourcePage: parseInt(line.source_page || line.page_number) || null,
          itemNo: line.item_no || line.line_no || null,
          description: line.description_of_work || line.description || null,
          scheduledValue: parseFloat(line.scheduled_value) || null,
          workCompletedPrev: parseFloat(line.work_completed_previous || line.previous_completed || line.work_prev) || null,
          workCompletedThis: parseFloat(line.work_completed_this_period || line.work_completed_this || line.work_this) || null,
          materialsStored: parseFloat(line.materials_stored) || null,
          totalCompleted: parseFloat(line.total_completed_and_stored || line.total_completed) || null,
          pctComplete: parseFloat(line.percent_complete || line.pct_complete || line.pct) || null,
          retainage: parseFloat(line.retainage) || null,
          balanceToFinish: parseFloat(line.balance_to_finish) || null,
          validationStatus: 'unchecked'
        }
      });
    }

    if (onProgress) {
      const amount = parseFloat(sub.completed_work_this_period || sub.net_amount || 0);
      onProgress(`Extracting ${subName}... done. $${amount.toLocaleString()} extracted.`);
    }
  }

  // Clean up
  fs.unlink(outputJson, () => {});

  return rawData.length;
}

module.exports = { extractSubcontractors };
