/**
 * Reconciliation Engine — compares GC G703 data against sub-contractor data
 * and generates exceptions based on 4 rules.
 */
const prisma = require('./prisma');

// Severity thresholds
function getSeverity(variance, lineValue) {
  const absVar = Math.abs(variance);
  const pct = lineValue ? (absVar / Math.abs(lineValue)) * 100 : 0;
  if (absVar > 10000 || pct > 5) return 'HIGH';
  if (absVar > 1000) return 'MEDIUM';
  return 'LOW';
}

async function reconcile(packageId) {
  // Get package + FILE_1 document for evidence linking
  const file1Doc = await prisma.packageDocument.findFirst({
    where: { packageId, fileRole: 'FILE_1' }
  });
  const evidenceDocId = file1Doc?.id || 1;

  // Get GC header for retainage %
  const gcHeader = await prisma.gcPayApplicationHeader.findFirst({ where: { packageId } });
  const retainagePct = gcHeader ? Number(gcHeader.totalRetainage || 0) / Math.max(Number(gcHeader.totalCompletedStored || 1), 1) * 100 : 5;

  // Get all GC SOV lines
  const gcLines = await prisma.gcPayApplicationSovLine.findMany({ where: { packageId } });

  // Get all sub-contractor headers and SOV lines
  const subHeaders = await prisma.subPayApplicationHeader.findMany({
    where: { packageId },
    include: { sovLines: true }
  });

  // Create validation run
  const runCount = await prisma.validationRun.count({ where: { packageId } });
  const validationRun = await prisma.validationRun.create({
    data: {
      packageId,
      runNumber: runCount + 1,
      runStatus: 'RUNNING',
      runStartedAt: new Date()
    }
  });

  const exceptions = [];

  // ── Rule 1: CROSS_FILE_MISMATCH ──────────────────────────────────────────
  if (subHeaders.length > 0) {
    for (const subHeader of subHeaders) {
      const subName = subHeader.subcontractorName || '';

      // GC amount: sum of workCompletedThis for lines matching this sub
      const matchingGcLines = gcLines.filter(l =>
        l.contractorName && l.contractorName.toUpperCase().includes(subName.toUpperCase())
      );
      const gcAmount = matchingGcLines.reduce((sum, l) => sum + Number(l.workCompletedThis || 0), 0);

      // Sub amount: sum of SOV lines workCompletedThis, or header completedWorkThisPeriod
      let subAmount = 0;
      if (subHeader.sovLines && subHeader.sovLines.length > 0) {
        subAmount = subHeader.sovLines.reduce((sum, l) => sum + Number(l.workCompletedThis || 0), 0);
      } else {
        subAmount = Number(subHeader.completedWorkThisPeriod || 0);
      }

      const variance = gcAmount - subAmount;
      if (Math.abs(variance) > 100) {
        const variancePct = gcAmount ? (variance / gcAmount) * 100 : 0;
        exceptions.push({
          exceptionTypeCode: 'CROSS_FILE_MISMATCH',
          entityType: 'sub_pay_application_header',
          entityId: subHeader.id,
          title: `Cross-file mismatch: ${subName}`,
          description: `GC G703 shows $${gcAmount.toLocaleString()} for ${subName}, but sub-contractor package shows $${subAmount.toLocaleString()}. Variance: $${variance.toLocaleString()} (${variancePct.toFixed(1)}%)`,
          file1Value: gcAmount,
          file2Value: subAmount,
          variance: Math.abs(variance),
          dollarAtRisk: Math.abs(variance),
          severity: getSeverity(variance, gcAmount),
          evidencePageNo: matchingGcLines[0]?.sourcePage || 1
        });
      }

      // Store reconciliation result
      await prisma.reconciliationResult.create({
        data: {
          packageId,
          validationRunId: validationRun.id,
          reconciliationType: 'CROSS_FILE',
          entityType: 'sub_pay_application_header',
          entityId: subHeader.id,
          jvAmount: gcAmount,
          subAmount: subAmount,
          variance: variance,
          passed: Math.abs(variance) <= 100,
          failureReason: Math.abs(variance) > 100 ? `Variance $${Math.abs(variance).toLocaleString()}` : null
        }
      });
    }
  }

  // ── Rule 2: MATH_ERROR — G703 column arithmetic ──────────────────────────
  for (const line of gcLines) {
    const prev = Number(line.workCompletedPrev || 0);
    const thisP = Number(line.workCompletedThis || 0);
    const mats = Number(line.materialsStored || 0);
    const totalG = Number(line.totalCompleted || 0);
    const scheduled = Number(line.scheduledCurrent || 0);
    const pctH = Number(line.pct || 0);

    // Check: D + E + F = G
    const expectedG = prev + thisP + mats;
    const diffG = Math.abs(totalG - expectedG);
    if (diffG > 1) {
      exceptions.push({
        exceptionTypeCode: 'MATH_ERROR',
        entityType: 'gc_pay_application_sov_line',
        entityId: line.id,
        title: `Math error: Line ${line.itemNo} — Total ≠ D+E+F`,
        description: `Expected total ${expectedG.toLocaleString()} (${prev.toLocaleString()} + ${thisP.toLocaleString()} + ${mats.toLocaleString()}), actual ${totalG.toLocaleString()}. Diff: $${diffG.toLocaleString()}`,
        file1Value: totalG,
        expectedValue: expectedG,
        variance: diffG,
        dollarAtRisk: diffG,
        severity: getSeverity(diffG, scheduled),
        evidencePageNo: line.sourcePage || 1
      });
    }

    // Check: % = G / C * 100
    if (scheduled > 0) {
      const expectedPct = (totalG / scheduled) * 100;
      const diffPct = Math.abs(pctH - expectedPct);
      if (diffPct > 0.5) {
        exceptions.push({
          exceptionTypeCode: 'MATH_ERROR',
          entityType: 'gc_pay_application_sov_line',
          entityId: line.id,
          title: `Math error: Line ${line.itemNo} — % Complete mismatch`,
          description: `Expected ${expectedPct.toFixed(1)}%, actual ${pctH.toFixed(1)}%. Diff: ${diffPct.toFixed(1)}%`,
          file1Value: pctH,
          expectedValue: expectedPct,
          variance: diffPct,
          dollarAtRisk: (diffPct / 100) * scheduled,
          severity: getSeverity((diffPct / 100) * scheduled, scheduled),
          evidencePageNo: line.sourcePage || 1
        });
      }
    }
  }

  // ── Rule 3: RETAINAGE_DEVIATION ──────────────────────────────────────────
  if (retainagePct > 0) {
    for (const line of gcLines) {
      const totalG = Number(line.totalCompleted || 0);
      const actualRet = Number(line.retainage || 0);
      if (totalG === 0 && actualRet === 0) continue;

      const expectedRet = totalG * (retainagePct / 100);
      const diffRet = Math.abs(actualRet - expectedRet);
      if (diffRet > 1) {
        exceptions.push({
          exceptionTypeCode: 'RETAINAGE_DEVIATION',
          entityType: 'gc_pay_application_sov_line',
          entityId: line.id,
          title: `Retainage deviation: Line ${line.itemNo}`,
          description: `Expected retainage $${expectedRet.toLocaleString()} (${retainagePct.toFixed(1)}% of $${totalG.toLocaleString()}), actual $${actualRet.toLocaleString()}`,
          file1Value: actualRet,
          expectedValue: expectedRet,
          variance: diffRet,
          dollarAtRisk: diffRet,
          severity: getSeverity(diffRet, totalG),
          evidencePageNo: line.sourcePage || 1
        });
      }
    }
  }

  // ── Rule 4: PERIOD_CONTINUITY ────────────────────────────────────────────
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: { contractId: true, billingPeriodMonth: true, billingPeriodYear: true }
  });

  if (pkg) {
    // Find previous package for same contract
    const prevPkg = await prisma.package.findFirst({
      where: {
        contractId: pkg.contractId,
        id: { not: packageId },
        packageStatus: { not: 'DRAFT' }
      },
      orderBy: [{ billingPeriodYear: 'desc' }, { billingPeriodMonth: 'desc' }]
    });

    if (prevPkg) {
      const prevHeader = await prisma.gcPayApplicationHeader.findFirst({
        where: { packageId: prevPkg.id }
      });
      if (prevHeader) {
        const prevTotal = Number(prevHeader.totalCompletedStored || 0);
        const currPrevSum = gcLines.reduce((sum, l) => sum + Number(l.workCompletedPrev || 0), 0);
        const diffCont = Math.abs(prevTotal - currPrevSum);

        if (diffCont > 100) {
          exceptions.push({
            exceptionTypeCode: 'PERIOD_CONTINUITY',
            entityType: 'gc_pay_application_header',
            entityId: packageId,
            title: 'Period continuity mismatch',
            description: `Previous period total completed was $${prevTotal.toLocaleString()}, but current period "From Previous" column sums to $${currPrevSum.toLocaleString()}. Diff: $${diffCont.toLocaleString()}`,
            file1Value: currPrevSum,
            expectedValue: prevTotal,
            variance: diffCont,
            dollarAtRisk: diffCont,
            severity: getSeverity(diffCont, prevTotal),
            evidencePageNo: 1
          });
        }
      }
    }
  }

  // ── Store exceptions ─────────────────────────────────────────────────────
  // Group exceptions by type
  const groupedByType = {};
  for (const ex of exceptions) {
    if (!groupedByType[ex.exceptionTypeCode]) {
      groupedByType[ex.exceptionTypeCode] = [];
    }
    groupedByType[ex.exceptionTypeCode].push(ex);
  }

  const displayLabels = {
    'CROSS_FILE_MISMATCH': 'Cross-File Mismatch (GC vs Sub)',
    'MATH_ERROR': 'Math Error (Column Arithmetic)',
    'RETAINAGE_DEVIATION': 'Retainage Deviation',
    'PERIOD_CONTINUITY': 'Period Continuity'
  };

  let riskRank = 1;
  for (const [typeCode, items] of Object.entries(groupedByType)) {
    const groupDollarAtRisk = items.reduce((sum, e) => sum + (e.dollarAtRisk || 0), 0);
    const maxSeverity = items.some(e => e.severity === 'HIGH') ? 'HIGH'
      : items.some(e => e.severity === 'MEDIUM') ? 'MEDIUM' : 'LOW';

    const group = await prisma.exceptionGroup.create({
      data: {
        packageId,
        validationRunId: validationRun.id,
        exceptionTypeCode: typeCode,
        displayLabel: displayLabels[typeCode] || typeCode,
        severity: maxSeverity,
        itemCount: items.length,
        dollarAtRisk: groupDollarAtRisk,
        status: 'open'
      }
    });

    for (const ex of items) {
      await prisma.exception.create({
        data: {
          packageId,
          validationRunId: validationRun.id,
          exceptionGroupId: group.id,
          exceptionTypeCode: ex.exceptionTypeCode,
          entityType: ex.entityType,
          entityId: ex.entityId,
          title: ex.title,
          description: ex.description,
          file1Value: ex.file1Value || null,
          file2Value: ex.file2Value || null,
          expectedValue: ex.expectedValue || null,
          variance: ex.variance || null,
          dollarAtRisk: ex.dollarAtRisk || null,
          riskRank: riskRank++,
          status: 'open',
          evidenceDocumentId: evidenceDocId,
          evidencePageNo: ex.evidencePageNo || null
        }
      });
    }
  }

  // Update validation run
  const totalDollarAtRisk = exceptions.reduce((sum, e) => sum + (e.dollarAtRisk || 0), 0);
  await prisma.validationRun.update({
    where: { id: validationRun.id },
    data: {
      runStatus: 'COMPLETE',
      runCompletedAt: new Date(),
      totalItems: gcLines.length,
      exceptionsCount: exceptions.length,
      dollarAtRisk: totalDollarAtRisk
    }
  });

  return { exceptionCount: exceptions.length, totalDollarAtRisk };
}

module.exports = { reconcile };
