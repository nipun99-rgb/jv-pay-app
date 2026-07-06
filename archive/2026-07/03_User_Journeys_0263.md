# 03 — User Journeys

**Version:** 1.0 · 24 June 2026 · Product Management

This document describes the **four front-door workflows**, the **12-stage processing spine**, the **happy path**, and **per-persona journeys**. Each maps to scenarios (S-xx) in the user story and to schema tables. QA should derive end-to-end test flows from here.

---

## 1. The four front doors

The product has exactly four entry workflows; everything else is a drill-down.

| Workflow | Trigger | Frequency | Output | Wave |
|---|---|---|---|---|
| **A — Contract Onboarding** | New contract | Once per contract | Contract baseline **v1** (SOV, rates, terms) — approved | 1 |
| **B — Monthly Package Run** | Monthly package arrives | Monthly (heartbeat) | Validated package + exceptions + approval | 1 |
| **C — Amendment Intake** | Addendum / CO / SOV revision | Recurring | **New effective-dated baseline version** | 1 |
| **D — Budget Baseline Intake** | Project budget / re-forecast | Once + revisions | Versioned **budget baseline** → budget-vs-actual | 1 (lightweight) / 3 (forecasting) |

> **A/C vs D:** the contract baseline says what may be *billed*; the budget baseline says what work is *expected to cost*. They are parallel, independently versioned, and never merged.

---

## 2. The 12-stage processing spine (Workflow B)

```text
CONTRACT BASELINE (living, effective-dated) ── version-in-force selected for the billing period
        │
        ▼
1. INGEST → 2. CLASSIFY → 3. EXTRACT → 4. MAP → 5. VALIDATE(math) → 6. RECONCILE
        → 7. CONTRACT BILLABILITY → 8. DUPLICATE + MISSING-SUPPORT
        → 9. EXCEPTION ASSEMBLY(rank) → 10. HUMAN REVIEW(cockpit)
        → 11. PACKAGE APPROVAL → 12. AUDIT + DASHBOARD + LEARNING LOOP
```

| # | Stage | Input | Output | Auto-clear target | Key tables |
|---|---|---|---|---|---|
| 1 | Ingest | Package files | Package/document/page records, file hashes | 100% | InvoicePackage, PackageDocument, DocumentPage |
| 2 | Classify | Documents/pages | Doc type + confidence; low-confidence queued | ≥90% | RawDocumentClassification |
| 3 | Extract | Classified docs | Fields, tables, line items, OCR + page + confidence | ≥85% high-conf | RawExtractedField/Table/Cell, DocumentExtractionRun |
| 4 | Map | Raw extraction | Canonical records; master-data candidates | ≥90% | SOVLineItem, PayApplicationHeader, MasterDataCandidate* |
| 5 | Validate (math) | Canonical data | Pass/fail per arithmetic rule + components | 100% executed | CalculationCheck, CalculationComponent |
| 6 | Reconcile | JV/sub/GC-GR/contract | Match/variance vs tolerance | 100% executed | ReconciliationResult |
| 7 | Contract billability | Billed vs baseline | Scope/SOV/rate/reimbursable/fee/retainage checks | 100% executed | ValidationResult, ContractBaselineVersion |
| 8 | Duplicate + missing support | Current + history | Duplicate candidates, missing-support items | 100% executed | DuplicateCandidate*, MissingSupport* |
| 9 | Exception assembly | All checks | Risk-ranked, grouped worklist + recommended actions | n/a | Exception, ExceptionGroup* |
| 10 | Human review | Worklist | Decisions + comments + evidence | exceptions only | ExceptionResolution, ReviewActionLog |
| 11 | Approval | Resolved package | Locked run, payment recommendation | human | ValidationRun |
| 12 | Audit + learning | Everything | Audit package, dashboards, feedback | 100% | EvidenceReference, DataChangeLog, UserFeedbackLog* |

\* Some support tables are Wave 2/3 — see [05_Feature_Roadmap.md](05_Feature_Roadmap.md).

---

## 3. The happy path (designed-for common case)

```text
Reviewer uploads package
   ▼
System processes stages 1–9 unattended  (e.g. 1,180 pages, 642 line items)
   ▼
Cockpit opens on a SUMMARY:
   • 612 line items auto-cleared (95%)
   • 18 exceptions, risk-ranked, grouped ("12 rate mismatches — bulk resolve")
   • $ at risk: $84,200 across 18 items
   ▼
Reviewer resolves/clears 18 items (evidence + recommended action)
   ▼
Finance approver sees one-screen summary ▸ Approve
   ▼
Audit package + dashboard published; corrections feed learning loop
```

**Design intent:** the reviewer's first screen is a *decision summary*, not a file browser. The clean 95% is collapsed and trustable; attention goes only to the 5%.

---

## 4. The living contract baseline journey (Workflow A + C)

```text
Contract v1 (eff 1-Jan)            ── validates Jan–Mar invoices
  + Addendum A (approved, eff 1-Apr) ─▶ Contract v2 ── validates Apr–May
  + Change Order 7 (approved, eff 1-Jun) ─▶ Contract v3 ── validates Jun+
  + Budget revision (approved, eff 1-Aug) ─▶ v4 ── validates Aug+
```

**Steps (C — Amendment Intake):**
1. Upload addendum/CO/SOV revision.
2. AI decomposes **only the delta** and renders a **before/after diff**.
3. Delta (not the whole contract) routes to a Commercial Reviewer.
4. On approval, a **new immutable, effective-dated version** is published; prior versions retained.
5. An approved CO updates `ContractSumToDate` and affected SOV current scheduled values for subsequent periods.

**What this prevents:** false "out-of-scope" flags for CO-added scope (S-56); catches a rate billed before its amendment effective date (S-57); diffs silent SOV inflation (S-55); reproducible historical re-runs (S-59); blocks overlapping effective windows (S-60).

---

## 5. Budget baseline & cost-to-complete journey (Workflow D)

1. Upload project cost budget (planned cost by WBS/cost code/phase) → AI proposes **v1** → Finance/Controller approves (S-61).
2. Monthly approved actuals (already captured by Workflow B) roll up per WBS/cost code.
3. System computes **budget-vs-actual** (MVP) and, later, **ETC / EAC / VAC** (Wave 3).
4. Re-forecasts create new versions; originals retained (S-62).
5. Negative VAC (projected over-run) surfaces as an early warning (S-64).

> **Hold the distinction:** pay-app "balance to finish" = remaining to *bill*; cost-to-complete = remaining *cost*. Never conflate (S-66).

---

## 6. Per-persona journeys

### 6.1 Invoice Reviewer (primary)
Upload package → wait (async processing, progress UI) → cockpit summary → triage risk-ranked grouped exceptions → open row → side-by-side (source page · extracted value · math · contract clause · recommended action) → Accept / Adjust / Reject (with comment) → bulk-resolve identical groups → hand to approver. Every edit preserves raw extraction (S-43).

### 6.2 Commercial Reviewer
Receives commercial-routed exceptions (rate, scope, reimbursable, fee, retainage) → reviews clause reference + recomputation → decides → may open Contract Baseline Manager to verify the version-in-force. Approves amendment/CO deltas in Workflow C.

### 6.3 Finance Approver
Opens one-screen package summary (auto-cleared count, open exceptions, $ at risk, accepted-exception rationale) → Approve / Approve-with-exceptions / Reject (S-44/S-45). RBAC blocks self-approval (separation of duties, S-46).

### 6.4 Data Steward (Wave 2)
Works the Master-Data Approval Queue → reviews candidate vendor/WBS/cost code with fuzzy-match merge suggestions → approve / merge / reject (S-15/S-16/S-65). No record is created without this step.

### 6.5 System Admin (Wave 2)
Manages templates, rules, tolerances, routing → proposes a rule/tolerance change → sees **regression impact on the golden set** before publishing (S-49) → eval-gated promotion.

### 6.6 Auditor
Audit Explorer → pick any value → one-click trace to page, math, decision, and user (S-52). Re-run a historical month reproduces results via the period's baseline version (S-59).

### 6.7 Leadership Viewer
Dashboard: package status, exceptions, $ at risk, time saved, budget-vs-actual. Read-only.

---

## 7. Cross-cutting journeys (resilience)

| Journey | Behavior | Scenario |
|---|---|---|
| Duplicate file re-uploaded | Detect by hash; warn; reviewer confirms skip/replace | S-01 |
| Corrupt / encrypted file | Quarantine/flag; continue rest of package | S-02/S-03 |
| Mixed file (multiple types in one PDF) | Page-level split + classify | S-04 |
| Very large package (1,200+ pp) | Chunked/async; progress UI; no timeout | S-07 |
| Extraction step fails mid-run | Retry; resume from checkpoint | S-47 |
| Reprocessing a package | New run; prior run preserved | S-48 |

---

## 8. Journey → acceptance gate traceability

The end-to-end Workflow B journey, plus Workflow A/C point-in-time validation, are the basis for MVP acceptance gates 1–9 in [08_Testing_Scenarios_and_Plan.md](08_Testing_Scenarios_and_Plan.md). QA must build at least one full real-package E2E test that exercises stages 1–12 plus one mid-stream amendment.
