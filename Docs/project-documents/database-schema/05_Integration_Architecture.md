# Database Schema Design — Invoice Validation & Review Platform
## Document 05: Integration Architecture

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## 1. Integration Overview

The database is the canonical data store for all integrations. External systems produce data (AI services, SharePoint, Entra ID) or consume data (Power BI, Power Apps, external APIs). All integration touchpoints are:
1. Logged in `api_integration_logs`
2. Stored in canonical tables before consumption
3. Never allowed to bypass the extraction → staging → canonical pipeline

```
External Systems                Database               Internal Consumers
─────────────────              ──────────             ─────────────────────
Azure Document Intelligence ──► raw_extracted_fields   React Frontend
Azure OpenAI                ──► raw_extracted_fields   Power BI (Wave 2)
SharePoint (files)          ──► package_documents     Power Apps (Wave 2)
Entra ID (identity)         ──► users / user_sessions  API Layer (Node.js)
                                     │
                                     ▼
                               api_integration_logs
                               (logs every external call)
```

---

## 2. SharePoint Integration

### 2.1 Use Cases

| Use Case | Direction | Tables Involved |
|---|---|---|
| Store uploaded PDFs in SharePoint | DB → SharePoint | `package_documents`, `sharepoint_document_refs` |
| Retrieve PDF for processing | SharePoint → DB | `sharepoint_document_refs` |
| Apply retention labels via Purview | SharePoint | `sharepoint_document_refs.retention_label` |
| Link document to package audit trail | Both | `sharepoint_document_refs` + `audit_events` |

### 2.2 `sharepoint_document_refs` — Integration Record

This table is the bridge between the internal document ID (`package_documents.id`) and the SharePoint identity. It enables the platform to:
- Retrieve any document by its SharePoint item ID
- Apply Purview retention policies
- Verify document existence and version in SharePoint
- Provide SharePoint URLs in the Evidence Viewer

```sql
-- When a file is stored in SharePoint:
INSERT INTO sharepoint_document_refs (
    package_document_id,
    sharepoint_site_id,
    sharepoint_drive_id,
    sharepoint_item_id,
    sharepoint_url,
    sharepoint_version,
    uploaded_at,
    retention_label
) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'Invoice-7yr')
```

### 2.3 SharePoint Document Library Structure (Recommended)

```
SharePoint Site: Invoice Review Platform
  └── Document Libraries:
       └── InvoicePackages/
            └── {client_code}/
                 └── {contract_no}/
                      └── {billing_period}/    e.g. 2026-06
                           ├── File1_GC_Cover.pdf
                           ├── File2_SubContractors.pdf
                           └── File3_SupportingDocs.pdf
```

This maps to:
```
sharepoint_document_refs.sharepoint_url = "https://{tenant}.sharepoint.com/sites/InvoiceReviewPlatform/InvoicePackages/{client_code}/{contract_no}/{period}/File1_GC_Cover.pdf"
```

### 2.4 API Integration Log Entry for SharePoint Calls

Every SharePoint Graph API call produces a row:
```sql
INSERT INTO api_integration_logs (
    package_id, service_name, operation, 
    http_method, response_status_code, duration_ms, success
) VALUES (
    ?, 'SHAREPOINT_GRAPH', 'upload_file',
    'PUT', 201, 1420, 1
)
```

---

## 3. Azure Document Intelligence Integration

### 3.1 Purpose

Azure Document Intelligence (formerly Form Recognizer) performs the OCR and structured field extraction from uploaded PDFs. It is the primary AI extraction service for G702/G703 forms.

### 3.2 Data Flow through the Database

```
PDF (stored in package_documents.stored_path / sharepoint_url)
    │
    ▼
Azure Document Intelligence API
    │  Response: { fields: [{name, value, confidence, boundingBox}], pages: [...] }
    │
    ▼
raw_extracted_fields (INSERT — immutable)
    │  One row per field extracted:
    │  { field_name, raw_value, normalized_value, bbox_x/y/w/h, extraction_confidence }
    │
    ▼
Canonical tables (INSERT/UPDATE)
    gc_pay_application_headers
    gc_pay_application_sov_lines
    sub_pay_application_headers
    sub_pay_application_sov_lines
    supporting_document_items
```

### 3.3 Bounding Box Coordinate System

Azure Document Intelligence returns bounding boxes as polygon points in inches from the top-left of the page. The database stores these in PDF points (1 pt = 1/72 inch). Conversion:

```
bbox_x = polygon.x[0] × 72
bbox_y = polygon.y[0] × 72
bbox_width = (polygon.x[1] - polygon.x[0]) × 72
bbox_height = (polygon.y[3] - polygon.y[0]) × 72
```

The `document_pages.width_pts` and `height_pts` columns store page dimensions to allow the Evidence Viewer to correctly position the bounding box overlay on the rendered PDF canvas.

### 3.4 Agent Run ID Pattern

Each extraction call to Azure Document Intelligence is assigned a UUID (`agent_run_id`) before the call is made. This ID is stored on:
- Every `raw_extracted_fields` row produced by this call
- Every canonical row produced from this call
- The `api_integration_logs` row for this call

This enables precise cross-referencing: "show me everything the agent extracted in run {id}" and "re-run only the rows from this run if it fails mid-way."

### 3.5 Confidence Threshold Enforcement

```sql
-- After extraction, identify low-confidence fields:
SELECT raf.field_name, raf.extraction_confidence, p.id AS package_id
FROM raw_extracted_fields raf
JOIN package_documents pd ON pd.id = raf.package_document_id
JOIN packages p ON p.id = pd.package_id
JOIN contract_configs cc ON cc.contract_id = p.contract_id
WHERE raf.extraction_confidence < cc.confidence_threshold
  AND pd.package_id = ?
```

These rows feed into `LOW_CONFIDENCE` exception generation.

---

## 4. Azure OpenAI Integration

### 4.1 Use Cases

Azure OpenAI is used for two specific tasks (both non-financial — money math is always deterministic):

| Task | Description | Tables Involved |
|---|---|---|
| Sub-contractor name fuzzy matching | Match GC G703 contractor names to sub-contractor application names when string matching fails | `agent_plan_items`, `sub_pay_application_headers`, `api_integration_logs` |
| Activity Feed message generation | Convert raw pipeline events into human-language business messages | `activity_logs` |

### 4.2 Fuzzy Matching — Database Pattern

```
gc_pay_application_sov_lines.contractor_name: "ABC ELEC WORKS INC"
sub_pay_application_headers.subcontractor_name: "ABC Electrical Works, Inc."

→ Azure OpenAI call: "Are these the same company? [list of names]"
→ Response: { matches: [{ jv_name: "ABC ELEC WORKS INC", sub_name: "ABC Electrical Works, Inc.", same_company: true }] }

→ Database update:
   gc_pay_application_sov_lines.file2_matched_sub_app_id = sub_app.id
   gc_pay_application_sov_lines.file2_extracted_amount = sub_app.g703_work_this_period
   api_integration_logs: INSERT (service: AZURE_OPENAI, tokens_used, cost_estimate_usd)
```

**Critical design note:** The fuzzy match result is used only to establish the JOIN between GC lines and sub applications. The reconciliation arithmetic (variance, tolerance check) is always computed deterministically from the matched numbers — never from the LLM response.

### 4.3 Token Usage Tracking

```sql
-- Monthly OpenAI cost report:
SELECT 
  strftime('%Y-%m', created_at) AS month,
  SUM(tokens_used) AS total_tokens,
  SUM(cost_estimate_usd) AS estimated_cost_usd,
  COUNT(*) AS api_calls
FROM api_integration_logs
WHERE service_name = 'AZURE_OPENAI'
  AND success = 1
GROUP BY strftime('%Y-%m', created_at)
ORDER BY month DESC
```

---

## 5. Power BI Integration (Wave 2)

### 5.1 Database Considerations

Power BI will connect to the Azure SQL production database via DirectQuery or Import mode. The schema supports this with:

1. **Denormalised summary columns** on `packages` (`total_items_extracted`, `auto_cleared_count`, `exceptions_count`, `dollar_at_risk`) — eliminates expensive COUNT/SUM joins in Power BI
2. **Status columns** on all key tables — enables filtering without complex state derivation
3. **`billing_period_label`** on packages — pre-computed display field for time-based slicers
4. **Consistent `created_at` timestamps** — all UTC, enabling accurate time-series analysis

### 5.2 Recommended Power BI Views (pre-build as SQL views in Azure SQL)

```sql
-- View: vw_package_dashboard
CREATE VIEW vw_package_dashboard AS
SELECT
  p.id, p.billing_period_label, p.package_status,
  c.contract_name, cl.name AS client_name,
  p.total_items_extracted, p.auto_cleared_count, p.exceptions_count,
  p.dollar_at_risk,
  reviewer.display_name AS reviewer_name,
  approver.display_name AS approver_name,
  p.submitted_at, p.reviewed_at, p.approved_at
FROM packages p
JOIN contracts c ON c.id = p.contract_id
JOIN clients cl ON cl.id = p.client_id
LEFT JOIN users reviewer ON reviewer.id = p.reviewed_by
LEFT JOIN users approver ON approver.id = p.approved_by;

-- View: vw_exception_summary
CREATE VIEW vw_exception_summary AS
SELECT
  e.id, e.exception_type_code, e.dollar_at_risk, e.status,
  e.risk_rank, p.billing_period_label, p.contract_id,
  et.display_name AS exception_type_name, et.severity, et.routing
FROM exceptions e
JOIN packages p ON p.id = e.package_id
JOIN ref_exception_types et ON et.code = e.exception_type_code;
```

### 5.3 Row-Level Security in Power BI

Power BI RLS must mirror the database `client_id` isolation. Define a RLS role in Power BI:
```
-- Power BI DAX RLS filter:
[client_id] = LOOKUPVALUE(users[client_id], users[email], USERNAME())
```

---

## 6. Power Apps Integration (Wave 2)

### 6.1 Dataverse Consideration

**Decision: Do not use Dataverse for this solution.**

The database schema is optimised for relational integrity, complex reconciliation queries, and high-volume financial data. Dataverse has limitations on complex JOINs, stored procedures, and aggregate queries that would significantly constrain the validation engine. The recommended architecture is:

- **Power Apps (canvas app)** as an alternative front-end for mobile/tablet use cases
- Power Apps connects via **custom connector** to the existing REST API
- No data stored in Dataverse; Power Apps is a pure UI layer

### 6.2 API Surface for Power Apps

The existing REST API (`/api/packages`, `/api/exceptions`, etc.) is the integration point. No additional database tables are required for Power Apps.

---

## 7. External API Integration Pattern

### 7.1 The `api_integration_logs` Contract

Every call to an external API — regardless of service — follows this pattern:

```javascript
// Before the call:
const logEntry = await db.insert('api_integration_logs', {
  package_id: packageId,
  service_name: 'AZURE_DOCUMENT_INTELLIGENCE',
  operation: 'analyze_document',
  http_method: 'POST',
  agent_run_id: agentRunId
});
const startTime = Date.now();

// Make the external call:
try {
  const response = await azureDocIntelligence.analyzeDocument(url, model);
  
  // After success:
  await db.update('api_integration_logs', logEntry.id, {
    response_status_code: 200,
    duration_ms: Date.now() - startTime,
    success: 1,
    response_payload_size_bytes: JSON.stringify(response).length
  });
  
} catch (error) {
  // After failure:
  await db.update('api_integration_logs', logEntry.id, {
    response_status_code: error.statusCode,
    duration_ms: Date.now() - startTime,
    success: 0,
    error_code: error.code,
    error_message: error.message.substring(0, 500)  // truncate
  });
}
```

### 7.2 Retry and Idempotency

When an extraction step fails mid-run, the system can safely retry because:
1. The `agent_run_id` identifies which fields came from which run
2. Raw extraction rows are append-only — a retry creates new rows, not overwrites
3. Canonical rows are cleared before re-insertion: `DELETE FROM gc_pay_application_sov_lines WHERE package_id = ? AND agent_run_id = ?` then re-INSERT
4. `processing_pipeline_steps.retry_count` is incremented on each retry

### 7.3 API Key Management

API keys for Azure Document Intelligence and Azure OpenAI are **never stored in the database**. They are stored in:
- MVP: Environment variables (`.env` file, not committed to source control)
- Production: Azure Key Vault, accessed via managed identity

The `system_configs` table may store non-secret configuration like endpoint URLs, model names, and API version identifiers (with `is_sensitive = 0`).

---

## 8. Future Integration Readiness

The schema is designed to accommodate these future integrations without structural changes:

| Future Integration | How Schema Supports It |
|---|---|
| ERP / Accounting system (e.g., SAP, Oracle) | `packages.billing_period_label` + `contracts.contract_no` provide the joining keys. An export table (`aic_ttbl_PaymentCertificates`) would be added in Wave 3 |
| Contract management system | `contracts.contract_no` is the external key. A `contracts.external_system_ref` column can be added via migration |
| Microsoft Purview (data governance) | `sharepoint_document_refs.retention_label` column ready. All tables have `created_at`/`updated_at` for lineage |
| Azure Data Factory (bulk processing) | `packages.package_status` and `processing_pipeline_steps.status` provide idempotent checkpoints for ADF pipeline restarts |
| Notification service (SendGrid, etc.) | `notifications.email_sent` + `notifications.email_sent_at` columns ready; notification content already stored |

---

*Document continues in: [06_Audit_Compliance_Performance.md](06_Audit_Compliance_Performance.md)*
