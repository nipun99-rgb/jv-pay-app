const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // ─── Seed Roles (7) ─────────────────────────────────────────────────────────
  const roles = [
    { code: "ADMIN", displayName: "Administrator", description: "Full system access" },
    { code: "REVIEWER", displayName: "Reviewer", description: "Reviews pay applications and resolves exceptions" },
    { code: "APPROVER", displayName: "Approver", description: "Final approval authority on packages" },
    { code: "SUBMITTER", displayName: "Submitter", description: "Uploads and submits packages for review" },
    { code: "VIEWER", displayName: "Viewer", description: "Read-only access to dashboards and reports" },
    { code: "CLIENT_ADMIN", displayName: "Client Admin", description: "Client-scoped administrator" },
    { code: "SYSTEM", displayName: "System", description: "System/agent service account role" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { displayName: role.displayName, description: role.description },
      create: role,
    });
  }
  console.log(`✓ Seeded ${roles.length} roles`);

  // ─── Seed Reference Exception Types (8) ─────────────────────────────────────
  const exceptionTypes = [
    { code: "MATH_ERROR", displayName: "Math Error", description: "Arithmetic/calculation mismatch", severity: "HIGH", routing: "REVIEWER", canBulkResolve: false, requiresCommentOnOverride: true, sortOrder: 1 },
    { code: "CROSS_FILE_MISMATCH", displayName: "Cross-File Mismatch", description: "Value differs between File 1 and File 2", severity: "HIGH", routing: "REVIEWER", canBulkResolve: true, requiresCommentOnOverride: true, sortOrder: 2 },
    { code: "RETAINAGE_DEVIATION", displayName: "Retainage Deviation", description: "Retainage % deviates from contract config", severity: "MEDIUM", routing: "REVIEWER", canBulkResolve: true, requiresCommentOnOverride: true, sortOrder: 3 },
    { code: "OVER_BILLING", displayName: "Over-Billing", description: "Billed amount exceeds scheduled value or 100%", severity: "HIGH", routing: "APPROVER", canBulkResolve: false, requiresCommentOnOverride: true, sortOrder: 4 },
    { code: "PERIOD_CONTINUITY", displayName: "Period Continuity", description: "Previous period totals do not match prior application", severity: "MEDIUM", routing: "REVIEWER", canBulkResolve: true, requiresCommentOnOverride: false, sortOrder: 5 },
    { code: "MISSING_SIGNATURE", displayName: "Missing Signature", description: "Required signature not detected on document", severity: "LOW", routing: "SUBMITTER", canBulkResolve: true, requiresCommentOnOverride: false, sortOrder: 6 },
    { code: "LOW_CONFIDENCE", displayName: "Low Extraction Confidence", description: "AI extraction confidence below threshold", severity: "MEDIUM", routing: "REVIEWER", canBulkResolve: true, requiresCommentOnOverride: false, sortOrder: 7 },
    { code: "UNMATCHED_SUB", displayName: "Unmatched Subcontractor", description: "Subcontractor in File 2 not found in File 1 SOV", severity: "HIGH", routing: "REVIEWER", canBulkResolve: false, requiresCommentOnOverride: true, sortOrder: 8 },
  ];

  for (const et of exceptionTypes) {
    await prisma.refExceptionType.upsert({
      where: { code: et.code },
      update: { displayName: et.displayName, description: et.description, severity: et.severity, routing: et.routing, canBulkResolve: et.canBulkResolve, requiresCommentOnOverride: et.requiresCommentOnOverride, sortOrder: et.sortOrder },
      create: et,
    });
  }
  console.log(`✓ Seeded ${exceptionTypes.length} ref_exception_types`);

  // ─── Seed Reference Document Types (3) ──────────────────────────────────────
  const docTypes = [
    { code: "GC_PAY_APP", displayName: "GC Pay Application (File 1)", fileRole: "FILE_1", description: "General Contractor payment application with G702/G703" },
    { code: "SUB_PAY_APPS", displayName: "Sub Pay Applications (File 2)", fileRole: "FILE_2", description: "Compiled subcontractor payment applications" },
    { code: "SUPPORTING_DOCS", displayName: "Supporting Documents (File 3)", fileRole: "FILE_3", description: "Invoices, lien waivers, and other supporting documentation" },
  ];

  for (const dt of docTypes) {
    await prisma.refDocumentType.upsert({
      where: { code: dt.code },
      update: { displayName: dt.displayName, fileRole: dt.fileRole, description: dt.description },
      create: dt,
    });
  }
  console.log(`✓ Seeded ${docTypes.length} ref_document_types`);

  // ─── Seed System Configs ─────────────────────────────────────────────────────
  const configs = [
    { configKey: "default_retainage_pct", configValue: "10.0", dataType: "decimal", description: "Default retainage percentage for new contracts" },
    { configKey: "default_math_tolerance", configValue: "0.01", dataType: "decimal", description: "Default math tolerance for validation" },
    { configKey: "default_cross_file_tolerance", configValue: "10.00", dataType: "decimal", description: "Default cross-file variance tolerance (dollars)" },
    { configKey: "default_confidence_threshold", configValue: "0.80", dataType: "decimal", description: "Minimum AI confidence score threshold" },
    { configKey: "session_timeout_minutes", configValue: "480", dataType: "integer", description: "User session timeout in minutes" },
    { configKey: "max_upload_size_mb", configValue: "100", dataType: "integer", description: "Maximum file upload size in megabytes" },
    { configKey: "azure_ocr_endpoint", configValue: "", dataType: "string", description: "Azure Document Intelligence endpoint URL", isSensitive: false },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { configKey: cfg.configKey },
      update: { configValue: cfg.configValue, dataType: cfg.dataType, description: cfg.description },
      create: cfg,
    });
  }
  console.log(`✓ Seeded ${configs.length} system_configs`);

  // ─── Seed Validation Rule Types ──────────────────────────────────────────────
  const ruleTypes = [
    { code: "MATH_CHECK", displayName: "Math Check", description: "Verify arithmetic on SOV line totals", producesExceptionType: "MATH_ERROR" },
    { code: "CROSS_FILE_RECONCILIATION", displayName: "Cross-File Reconciliation", description: "Compare File 1 vs File 2 amounts", producesExceptionType: "CROSS_FILE_MISMATCH" },
    { code: "RETAINAGE_CHECK", displayName: "Retainage Check", description: "Verify retainage calculations match contract config", producesExceptionType: "RETAINAGE_DEVIATION" },
    { code: "OVER_BILLING_CHECK", displayName: "Over-Billing Check", description: "Detect amounts exceeding scheduled values", producesExceptionType: "OVER_BILLING" },
    { code: "PERIOD_CONTINUITY_CHECK", displayName: "Period Continuity Check", description: "Verify previous period amounts match prior app", producesExceptionType: "PERIOD_CONTINUITY" },
    { code: "CONFIDENCE_CHECK", displayName: "Confidence Check", description: "Flag fields below confidence threshold", producesExceptionType: "LOW_CONFIDENCE" },
  ];

  for (const rt of ruleTypes) {
    await prisma.refValidationRuleType.upsert({
      where: { code: rt.code },
      update: { displayName: rt.displayName, description: rt.description, producesExceptionType: rt.producesExceptionType },
      create: rt,
    });
  }
  console.log(`✓ Seeded ${ruleTypes.length} ref_validation_rule_types`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
