/**
 * migrate-sqlite-to-azure.js
 * 
 * Migrates data from the legacy projects.db (SQLite via sql.js) into the new
 * Azure SQL schema (via Prisma Client).
 * 
 * Mapping:
 *   SQLite projects       → Client (1 shared) + Contract + Package
 *   SQLite cover_page     → GcPayApplicationHeader
 *   SQLite line_items     → GcPayApplicationSovLine
 *   SQLite subcontractor_applications → SubPayApplicationHeader
 *   SQLite sub_line_items → SubPayApplicationSovLine
 *   SQLite logs           → ActivityLog
 *   SQLite tasks          → ProcessingPipelineStep
 *   SQLite project_phases → (encoded in Package status/documents)
 *
 * Usage: node scripts/migrate-sqlite-to-azure.js
 */

require("dotenv").config();
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DB_PATH = path.join(__dirname, "..", "projects.db");

// Helper: convert SQLite row array to object given column names
function rowToObj(columns, values) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return obj;
}

// Helper: query SQLite and return array of objects
function query(db, sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => rowToObj(columns, row));
}

// Helper: safe decimal (null if value is null/undefined/empty)
function dec(val) {
  if (val === null || val === undefined || val === "") return null;
  return parseFloat(val) || 0;
}

async function main() {
  console.log("═══ SQLite → Azure SQL Migration ═══\n");

  // Load SQLite
  if (!fs.existsSync(DB_PATH)) {
    console.error("ERROR: projects.db not found at", DB_PATH);
    process.exit(1);
  }
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  // Read all SQLite data
  const projects = query(db, "SELECT * FROM projects");
  const lineItems = query(db, "SELECT * FROM line_items");
  const coverPages = query(db, "SELECT * FROM cover_page");
  const subApps = query(db, "SELECT * FROM subcontractor_applications");
  const subLines = query(db, "SELECT * FROM sub_line_items");
  const logs = query(db, "SELECT * FROM logs");
  const tasks = query(db, "SELECT * FROM tasks");
  const phases = query(db, "SELECT * FROM project_phases");

  console.log(`Source data: ${projects.length} projects, ${lineItems.length} line items, ${coverPages.length} covers, ${subApps.length} sub apps, ${subLines.length} sub lines, ${logs.length} logs`);

  // 1. Create a single "Legacy" client for all migrated projects
  const client = await prisma.client.upsert({
    where: { code: "LEGACY" },
    update: {},
    create: {
      name: "Legacy Migration Client",
      code: "LEGACY",
      contactEmail: "admin@localhost",
      isActive: true,
    },
  });
  console.log(`✓ Client: ${client.name} (id=${client.id})`);

  // Track ID mappings: oldProjectId → { contractId, packageId }
  const projectMap = {};

  for (const proj of projects) {
    console.log(`\n── Migrating Project ${proj.id}: "${proj.name}" ──`);

    // 2. Create Contract per project
    const contract = await prisma.contract.create({
      data: {
        clientId: client.id,
        contractName: proj.name || `Project ${proj.id}`,
        contractNo: `LEGACY-${proj.id}`,
        isActive: true,
      },
    });

    // 3. Create Package per project (use billing period based on creation or dummy)
    const createdDate = proj.created_at ? new Date(proj.created_at) : new Date();
    const billingMonth = createdDate.getMonth() + 1;
    const billingYear = createdDate.getFullYear();

    // Determine package status from phases
    const projectPhases = phases.filter(p => p.project_id === proj.id);
    let packageStatus = "DRAFT";
    if (projectPhases.some(p => p.status === "complete")) {
      packageStatus = "EXTRACTED";
    }

    const pkg = await prisma.package.create({
      data: {
        clientId: client.id,
        contractId: contract.id,
        billingPeriodMonth: billingMonth,
        billingPeriodYear: billingYear,
        billingPeriodLabel: `${billingYear}-${String(billingMonth).padStart(2, "0")}`,
        packageStatus,
      },
    });

    projectMap[proj.id] = { contractId: contract.id, packageId: pkg.id };
    console.log(`  Contract id=${contract.id}, Package id=${pkg.id}, status=${packageStatus}`);

    // 4. Migrate cover_page → GcPayApplicationHeader
    const cover = coverPages.find(c => c.project_id === proj.id);
    if (cover) {
      await prisma.gcPayApplicationHeader.create({
        data: {
          packageId: pkg.id,
          toOwner: cover.to_owner,
          fromContractor: cover.from_contractor,
          projectName: cover.project_name,
          applicationNo: cover.application_no,
          period: cover.period,
          originalContractSum: dec(cover.original_contract_sum),
          netChangeOrders: dec(cover.net_change_orders),
          contractSumToDate: dec(cover.contract_sum_to_date),
          totalCompletedStored: dec(cover.total_completed_stored),
          retainageCompleted: dec(cover.retainage_completed),
          retainageMaterials: dec(cover.retainage_materials),
          totalRetainage: dec(cover.total_retainage),
          totalEarnedLessRet: dec(cover.total_earned_less_ret),
          lessPrevCertificates: dec(cover.less_prev_certificates),
          currentPaymentDue: dec(cover.current_payment_due),
          balanceToFinish: dec(cover.balance_to_finish),
          changeOrderSummary: cover.change_order_summary,
          architectSignature: cover.architect_signature,
          contractorSignature: cover.contractor_signature,
          sourcePage: cover.source_page || 1,
          reviewNotes: cover.review_notes,
          validationNotes: cover.validation_notes,
          validationStatus: "unchecked",
        },
      });
      console.log(`  ✓ GcPayApplicationHeader migrated`);
    }

    // 5. Migrate line_items → GcPayApplicationSovLine
    const projLineItems = lineItems.filter(li => li.project_id === proj.id);
    if (projLineItems.length > 0) {
      await prisma.gcPayApplicationSovLine.createMany({
        data: projLineItems.map(li => ({
          packageId: pkg.id,
          itemNo: li.item_no,
          timePeriod: li.time_period,
          phases: li.phases,
          typeOfWork: li.type_of_work,
          contractorName: li.contractor_name,
          scheduledOriginal: dec(li.scheduled_original),
          scheduledChangeOrders: dec(li.scheduled_change_orders),
          scheduledCurrent: dec(li.scheduled_current),
          workCompletedPrev: dec(li.work_completed_prev),
          workCompletedThis: dec(li.work_completed_this),
          materialsStored: dec(li.materials_stored),
          totalCompleted: dec(li.total_completed),
          pct: dec(li.pct),
          balanceToFinish: dec(li.balance_to_finish),
          retainage: dec(li.retainage),
          sourcePage: li.source_page,
          reviewNotes: li.review_notes,
          validationStatus: li.validation_status || "unchecked",
          validationNote: li.validation_note,
        })),
      });
      console.log(`  ✓ ${projLineItems.length} GcPayApplicationSovLines migrated`);
    }

    // 6. Migrate subcontractor_applications → SubPayApplicationHeader
    const projSubApps = subApps.filter(sa => sa.project_id === proj.id);
    // Need to track old sub_app_id → new id for sub_line_items
    const subAppIdMap = {};

    for (const sa of projSubApps) {
      const subHeader = await prisma.subPayApplicationHeader.create({
        data: {
          packageId: pkg.id,
          seqId: sa.seq_id,
          startPage: sa.start_page,
          endPage: sa.end_page,
          documentType: sa.document_type,
          documentCategory: sa.document_category,
          subcontractorName: sa.subcontractor_name,
          applicationNo: sa.application_no,
          applicationDate: sa.application_date,
          periodFrom: sa.period_from,
          periodTo: sa.period_to,
          invoiceTo: sa.invoice_to,
          projectNameOnDoc: sa.project_name_on_doc,
          contractPoNumber: sa.contract_po_number,
          originalContractSum: dec(sa.original_contract_sum),
          netChangeOrders: dec(sa.net_change_orders),
          contractSumToDate: dec(sa.contract_sum_to_date),
          totalCompletedStored: dec(sa.total_completed_stored),
          completedWorkThisPeriod: dec(sa.completed_work_this_period),
          totalRetainage: dec(sa.total_retainage),
          retainagePercent: dec(sa.retainage_percent),
          totalEarnedLessRetainage: dec(sa.total_earned_less_retainage),
          lessPrevCertificates: dec(sa.less_prev_certificates),
          currentPaymentDue: dec(sa.current_payment_due),
          balanceToFinish: dec(sa.balance_to_finish),
          g703ScheduledValue: dec(sa.g703_scheduled_value),
          g703WorkPrev: dec(sa.g703_work_prev),
          g703WorkThisPeriod: dec(sa.g703_work_this_period),
          g703MaterialsStored: dec(sa.g703_materials_stored),
          g703TotalCompleted: dec(sa.g703_total_completed),
          g703Retainage: dec(sa.g703_retainage),
          g703EarnedLessRet: dec(sa.g703_earned_less_ret),
          g703BalanceToFinish: dec(sa.g703_balance_to_finish),
          reconFlag: sa.recon_flag,
          contractorSignature: sa.contractor_signature,
          architectSignature: sa.architect_signature,
          notarized: sa.notarized,
          additionalSupportingDocs: sa.additional_supporting_docs,
          validationStatus: sa.validation_status || "unchecked",
          validationNote: sa.validation_note,
          rawJson: sa.raw_json,
        },
      });
      subAppIdMap[sa.id] = subHeader.id;
    }
    if (projSubApps.length > 0) {
      console.log(`  ✓ ${projSubApps.length} SubPayApplicationHeaders migrated`);
    }

    // 7. Migrate sub_line_items → SubPayApplicationSovLine
    const projSubLines = subLines.filter(sl => sl.project_id === proj.id);
    if (projSubLines.length > 0) {
      const subLineData = projSubLines
        .filter(sl => subAppIdMap[sl.sub_app_id]) // only if parent was migrated
        .map(sl => ({
          packageId: pkg.id,
          subAppId: subAppIdMap[sl.sub_app_id],
          sourcePage: sl.source_page,
          itemNo: sl.item_no,
          description: sl.description,
          scheduledValue: dec(sl.scheduled_value),
          workCompletedPrev: dec(sl.work_completed_prev),
          workCompletedThis: dec(sl.work_completed_this),
          materialsStored: dec(sl.materials_stored),
          totalCompleted: dec(sl.total_completed),
          pctComplete: dec(sl.pct_complete),
          retainage: dec(sl.retainage),
          validationStatus: "unchecked",
        }));
      
      if (subLineData.length > 0) {
        await prisma.subPayApplicationSovLine.createMany({ data: subLineData });
        console.log(`  ✓ ${subLineData.length} SubPayApplicationSovLines migrated`);
      }
    }

    // 8. Migrate logs → ActivityLog
    const projLogs = logs.filter(l => l.project_id === proj.id);
    if (projLogs.length > 0) {
      await prisma.activityLog.createMany({
        data: projLogs.map(l => ({
          packageId: pkg.id,
          level: l.level || "info",
          message: l.message || "(empty)",
        })),
      });
      console.log(`  ✓ ${projLogs.length} ActivityLogs migrated`);
    }

    // 9. Migrate tasks → ProcessingPipelineStep
    const projTasks = tasks.filter(t => t.project_id === proj.id);
    if (projTasks.length > 0) {
      await prisma.processingPipelineStep.createMany({
        data: projTasks.map(t => ({
          packageId: pkg.id,
          stepNo: t.step_number,
          stepName: t.step_name || `Step ${t.step_number}`,
          status: t.status || "pending",
        })),
      });
      console.log(`  ✓ ${projTasks.length} ProcessingPipelineSteps migrated`);
    }
  }

  // Summary
  console.log("\n═══ Migration Complete ═══");
  console.log(`  Projects migrated: ${projects.length}`);
  console.log(`  Contracts created: ${projects.length}`);
  console.log(`  Packages created: ${projects.length}`);
  console.log(`  Line items: ${lineItems.length}`);
  console.log(`  Sub applications: ${subApps.length}`);
  console.log(`  Sub line items: ${subLines.length}`);
  console.log(`  Logs: ${logs.length}`);
  console.log(`  Tasks: ${tasks.length}`);
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
