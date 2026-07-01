# 04 — Architecture & Data Model

**Version:** 1.0 · 24 June 2026 · Solution Architecture + Product Management
**Companion:** `Docs/Business requirements/table-schema.md` (96-table model, authoritative DDL blueprint)

---

## 1. Architecture principles

1. **Separation of concerns:** agents (extract/propose) ≠ rules engine (validate/compute) ≠ canonical store (truth) ≠ cockpit (decide). No layer reaches across another's responsibility.
2. **Deterministic where it matters:** all money math and reconciliation run in a deterministic engine (SQL procs / Python services), never an LLM.
3. **Raw is immutable:** extracted raw values are never overwritten; corrections are new records linked to raw.
4. **Event-driven & resumable:** stages communicate via events/queue; every stage is checkpointed and idempotent.
5. **Point-in-time correctness:** contract & budget baselines are effective-dated; validation selects the version-in-force deterministically.
6. **Audit by construction:** every value carries evidence (document, page, bbox) and every change is logged.

---

## 2. Logical architecture (C4 — container level)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              REVIEWER COCKPIT (UI)                              │
│   Summary · risk-ranked exceptions · evidence viewer · approval · dashboards   │
└───────────────▲───────────────────────────────────────────────▲──────────────┘
                │ REST/GraphQL API                               │ Power BI / DirectQuery
┌───────────────┴───────────────────────────────────────────────┴──────────────┐
│                          APPLICATION / API LAYER                               │
│   AuthZ (Entra ID) · package API · exception API · baseline API · audit API    │
└───────────────▲───────────────────────────────────────────────────────────────┘
                │ events / commands
┌───────────────┴───────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION (Azure Functions / Power Automate / Fabric)    │
│   Stage workflow · retries · checkpoints · async chunking for large packages   │
└───┬───────────────┬───────────────┬───────────────┬───────────────┬───────────┘
    ▼               ▼               ▼               ▼               ▼
┌────────┐   ┌────────────┐   ┌────────────┐   ┌───────────────┐   ┌───────────┐
│Ingestion│  │Classify+   │   │Mapping +   │   │Rules &        │   │Exception  │
│agent    │  │Extract     │   │Master-data │   │Calculation    │   │assembly + │
│         │  │(Doc Intel +│   │candidate   │   │+ Reconciliation│  │risk-rank  │
│         │  │ Azure OpenAI)│ │agent       │   │engine (determ.)│  │agent      │
└────┬────┘   └─────┬──────┘   └─────┬──────┘   └───────┬───────┘   └─────┬─────┘
     │              │                │                  │                 │
     ▼              ▼                ▼                  ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       CANONICAL DATA STORE — Azure SQL (96-table model)         │
│  master · reference · config · staging(raw) · transaction · link · audit       │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲                                   ▲                          ▲
        │                                   │                          │
┌───────┴────────┐               ┌──────────┴─────────┐      ┌─────────┴─────────┐
│ Document repo  │               │ Entra ID (identity)│      │ Purview (governance│
│ Blob/SharePoint│               │ RBAC               │      │ + lineage)         │
└────────────────┘               └────────────────────┘      └───────────────────┘
```

---

## 3. The agents (logical) and their stage ownership

| Agent | Owns stages | Reads | Writes | Autonomy |
|---|---|---|---|---|
| Ingestion | 1 | files | InvoicePackage, PackageDocument, DocumentPage, file hash | Full |
| Classification | 2 | documents/pages | RawDocumentClassification | Full; low-conf → queue |
| Extraction | 3 | classified docs | DocumentExtractionRun, RawExtractedField/Table/Cell, RawOCRText | Full; raw immutable |
| Mapping | 4 | raw extraction | SOVLineItem, PayApplicationHeader/Summary, InvoiceHeader/Line, MasterDataCandidate | Propose master data |
| Calculation | 5 | canonical | CalculationCheck, CalculationComponent | Deterministic |
| Reconciliation | 6 | canonical, history | ReconciliationResult | Deterministic |
| Billability | 7 | canonical, baseline version | ValidationResult | Propose; commercial decides |
| Duplicate/Support | 8 | canonical, history | DuplicateCandidate, MissingSupport | Propose; human disposes |
| Exception assembly | 9 | all results | Exception, ExceptionGroup | Routing rules |
| Audit/Learning | 12 | everything | EvidenceReference, DataChangeLog, UserFeedbackLog | Full |

> Baseline-version selection (point-in-time) is a deterministic service shared by stages 5–7.

---

## 4. Data model overview (96 tables, 12 families)

Naming convention (prefix → family):

| Prefix | Family | Purpose | Count |
|---|---|---|---|
| `aic_mtbl_` | master | slowly-changing business entities | 18 + 3 ext |
| `aic_rtbl_` | reference | lookup values | 10 |
| `aic_ctbl_` | config | rules / tolerances / templates | 11 + 1 ext |
| `aic_ttbl_` | transaction | monthly operational data | 7+7+4+7+ ext |
| `aic_ltbl_` | link | mapping tables | incl. ext |
| `aic_stbl_` | staging | raw extraction | 5 + 1 ext |
| `aic_atbl_` | audit | logs | 5 |

Authoritative column-level DDL is in `table-schema.md`. Engineering must generate the executable SQL Server DDL from that file (PKs, FKs, indexes, defaults).

### 4.1 Standard columns (all tables unless noted)

```sql
CreatedAtUtc   DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
CreatedBy      NVARCHAR(150) NULL,
UpdatedAtUtc   DATETIME2(3) NULL,
UpdatedBy      NVARCHAR(150) NULL,
IsActive       BIT NOT NULL DEFAULT 1,
RecordVersion  INT NOT NULL DEFAULT 1
```

### 4.2 Agent-populated columns (extraction tables)

```sql
AgentRunId            UNIQUEIDENTIFIER NULL,
ExtractionConfidence  DECIMAL(5,2) NULL,
ValidationStatusCode  NVARCHAR(50) NULL,
ReviewStatusCode      NVARCHAR(50) NULL,
SourceDocumentId      BIGINT NULL,
SourcePageNo          INT NULL
```

### 4.3 Standard data types

| Element | Type |
|---|---|
| PK | `BIGINT IDENTITY(1,1)` |
| Name/code | `NVARCHAR(255)` |
| Amount | `DECIMAL(18,2)` |
| Rate/% | `DECIMAL(18,6)` |
| Quantity | `DECIMAL(18,4)` |
| Date / datetime | `DATE` / `DATETIME2(3)` |
| JSON payload | `NVARCHAR(MAX)` |

---

## 5. Core relationship map

```text
Project
 ├── Budget Baseline (versioned) ──► Cost-to-Complete Snapshot
 └── Contract
      ├── Contract Baseline Version (living, versioned) ── governs all Contract* definitions
      ├── Contract SOV / Scope / Rate Card / Billing Terms / Reimbursable / Retainage / Fee / CO …
      └── Billing Cycle
           └── Invoice Package
                ├── Package Documents → Pages → Raw Extraction (+ page-level classification) → Evidence
                ├── Pay Applications (→ Baseline Version) → Summary / SOV Lines / JV-Sub Mapping
                ├── Vendor Invoices / Expenses
                ├── Change Orders
                ├── Validation Runs (→ Baseline Version) → Calc Checks / Reconciliation / Exceptions (→ Group)
                ├── Duplicate Candidates
                └── Missing Support
Cross-cutting: Master-Data Candidate queue → approved → master entities · Ground Truth → Accuracy Eval · User → Role (RBAC)
```

---

## 6. The living baseline pattern (most important data design)

- `aic_mtbl_ContractBaselineVersion` holds `VersionNo`, `EffectiveFrom`, `EffectiveTo` (NULL = open), `ChangeSourceTypeCode`, `ApprovalStatusCode`.
- Every `Contract*Define` table carries a nullable `BaselineVersionId` FK → version that produced the attribute.
- `PayApplicationHeader` and `ValidationRun` carry `BaselineVersionId` = version validated against.
- **Selection rule:** for a package, choose the approved version where `EffectiveFrom ≤ PeriodTo` and (`EffectiveTo IS NULL OR EffectiveTo ≥ PeriodFrom`). Enforce **non-overlapping** effective windows (constraint + pre-activation check, S-60).
- Budget baseline mirrors this via `aic_mtbl_BudgetBaselineDefine` + `aic_ttbl_CostToCompleteSnapshot`.

---

## 7. Integration / API contracts (Wave 1, indicative)

| API | Method | Purpose | Notes |
|---|---|---|---|
| `/packages` | POST | Create/upload a package | returns packageId; triggers Workflow B |
| `/packages/{id}` | GET | Package status + summary counts | auto-cleared, exceptions, $ at risk |
| `/packages/{id}/exceptions` | GET | Risk-ranked, grouped exceptions | supports group + sort by $ at risk |
| `/exceptions/{id}/resolve` | POST | Reviewer decision + comment | writes ExceptionResolution + ReviewActionLog |
| `/exceptions/group/{id}/bulk-resolve` | POST | Bulk-resolve a group | S-40 |
| `/evidence/{entityType}/{entityId}` | GET | Evidence (page, bbox, math) | drives evidence viewer |
| `/contracts/{id}/baseline-versions` | GET | Version history + diffs | Contract Baseline Manager |
| `/contracts/{id}/amendments` | POST | Submit amendment/CO for delta+diff | Workflow C |
| `/packages/{id}/approve` | POST | Approve / approve-with-exceptions / reject | RBAC: separation of duties |
| `/audit/trace/{entityType}/{entityId}` | GET | Full trace: page→math→decision→user | S-52 |

All APIs authenticated via Entra ID; authorization enforced by role (see [09_NFR_Security_and_Governance.md](09_NFR_Security_and_Governance.md)).

---

## 8. Key data-integrity rules (must be enforced in DB/service)

1. Raw extraction rows are append-only; corrections create new canonical rows referencing raw.
2. `% complete ≤ 100%` and `≤ revised contract value` → hard-stop (blocking) exception (S-25).
3. Effective windows of baseline versions per contract must not overlap.
4. No master record is inserted from extraction directly — only via approved `MasterDataCandidate`.
5. Every `Exception` must have at least one `EvidenceReference` (no unexplained exceptions).
6. A package approval requires a different user than the reviewer (separation of duties).

---

## 9. Environments & deployment (high level)

| Env | Purpose | Data |
|---|---|---|
| Dev | Engineering | Synthetic + redacted golden subset |
| Test / QA | Scenario + accuracy harness | Golden dataset (15–25 labeled packages) |
| UAT | Real reviewers, viability gates | Real packages (controlled) |
| Prod | Live | Real, governed via Purview |

CI/CD via Azure DevOps; schema as versioned migrations (additive only across waves); secrets in Key Vault. Detail in [07_Implementation_Roadmap_and_Backlog.md](07_Implementation_Roadmap_and_Backlog.md) and [09](09_NFR_Security_and_Governance.md).

---

## 10. Technology stack (greenfield, per BRD)

| Layer | Choice |
|---|---|
| Document repository | Azure Blob / SharePoint |
| OCR & extraction | Azure Document Intelligence |
| AI extraction/classification | Azure OpenAI / Copilot Studio pattern |
| Orchestration | Azure Functions / Power Automate / Fabric Data Factory |
| Canonical store | Azure SQL (96-table model, built per-wave) |
| Rules & calc engine | Deterministic Python services / SQL stored procedures |
| Reviewer experience | Power Apps or custom web app (React) |
| Reporting | Power BI |
| Identity / governance / monitoring | Entra ID · Purview · App Insights |
