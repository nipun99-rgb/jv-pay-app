# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

## [2026-07-02] – Repository Restructure

### Added
- `scripts/` hierarchy: `pdf-extraction/` and `data-push/` sub-folders
- `data/` hierarchy: `app12/`, `app13/`, `other-apps/`, `subcontractors/`, `cache/`
- `assets/source-documents/` for source PDF files
- `notebooks/` for Jupyter extraction notebooks
- `archive/2026-07/` with `ARCHIVE_MANIFEST.md` documenting all archived files
- `README.md` – project overview and structure guide
- `CHANGELOG.md` – this file

### Changed
- `Docs/` renamed to `docs/` (lowercase, per naming convention)
- `Docs/initial-brd-documents/` → `docs/brd/`
- `Docs/UI-UX-design/` → `docs/ui-ux/`
- `Docs/Updated-user-journey-design/` → `docs/user-journeys/`
- `extraction-script/` renamed to `notebooks/`
- `Test Files/` removed; PDFs moved to `assets/source-documents/`
- `graphql_push8.ps1` → `scripts/data-push/push-graphql-data.ps1` (canonical rename)
- `api_push2.ps1` → `scripts/data-push/push-api-data.ps1` (canonical rename)
- `.gitignore` updated to reflect new folder paths

### Archived (→ `archive/2026-07/`)
- `graphql_push.ps1` through `graphql_push7.ps1` – superseded by `push-graphql-data.ps1`
- `api_push.ps1` – superseded by `push-api-data.ps1`
- `gc_app12_line_items.csv`, `_v2`, `_v3`, `_v4` – superseded by `_v5.csv`
- `gc_app12_cover.csv` – superseded by `gc_app12_cover_v2.csv`
- `debug_item079.py`, `debug_page8.py`, `debug_split_rows.py` – one-off debug scripts
- `run_cell6.py`, `fix_nb.py`, `sync_nb.py`, `check_items.py` – ad-hoc utilities
- `_compare.py`, `_diag_words.py`, `_inspect.py`, `_render_app13.py` – scratch files
- `_test_extract.csv` – scratch test file
- `03_User_Journeys_0263.md` – orphaned version variant; canonical in `docs/brd/`
- `Docs/Lovable example App/` – abandoned Lovable.dev prototype (TypeScript/React); moved to `archive/2026-07/lovable-example-app/`

### Moved
- All `gc_app12_*` files → `data/app12/`
- All `gc_app13_*` files → `data/app13/`
- All `gc_app2–8_*` files → `data/other-apps/`
- All `payapp12_*` cache files → `data/app12/`
- All `subcontractor_*` output files → `data/subcontractors/`
- `build_app13_csv.py`, `pdfplumber_extract*.py` → `scripts/pdf-extraction/`
- `push_to_github.ps1` → `scripts/`
- `*.ipynb` notebooks → `notebooks/`
- Source PDFs from `Test Files/` → `assets/source-documents/`
