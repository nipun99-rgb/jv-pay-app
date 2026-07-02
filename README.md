# Construction Payment Application Manager

A full-stack web application for managing construction payment applications (Pay Apps), featuring automated PDF extraction of AIA G702/G703 forms and subcontractor schedules of values.

---

## Repository Structure

```
/
├── project-manager/          # Full-stack web application
│   ├── backend/              # Node.js/Express API server + SQLite DB
│   │   ├── server.js         # Main API server entry point
│   │   ├── db.js             # Database connection and schema
│   │   ├── extract_g703.py   # G703 extraction helper (Python)
│   │   ├── extract_subcontractors.py
│   │   └── uploads/          # Uploaded PDFs + extraction artifacts
│   └── frontend/             # React + Vite SPA
│       ├── src/
│       │   ├── components/   # Feature UI components
│       │   │   └── shared/   # Shared/reusable components
│       │   ├── App.jsx
│       │   └── main.jsx
│       └── index.html
│
├── notebooks/                # Jupyter notebooks for PDF extraction R&D
│   ├── gc_app12_extractor.ipynb
│   ├── invoice_extractor.ipynb
│   └── subcontractor_extractor.ipynb
│
├── scripts/                  # Utility and automation scripts
│   ├── pdf-extraction/       # PDF → CSV pipeline scripts (Python)
│   │   ├── pdfplumber_extract.py
│   │   ├── pdfplumber_extract_app13.py
│   │   └── build_app13_csv.py
│   ├── data-push/            # API and GraphQL data push scripts
│   │   ├── push-graphql-data.ps1
│   │   └── push-api-data.ps1
│   └── push_to_github.ps1
│
├── data/                     # Extracted data outputs (CSV, JSON)
│   ├── app12/                # Pay Application 12 data
│   ├── app13/                # Pay Application 13 data
│   ├── other-apps/           # Pay Applications 2–8 data
│   ├── subcontractors/       # Subcontractor schedule data and summaries
│   └── cache/                # OCR/scan cache (gitignored)
│
├── assets/
│   └── source-documents/     # Source PDF documents (gitignored binaries)
│
├── docs/                     # Project documentation
│   ├── brd/                  # Business Requirements Documents
│   ├── ui-ux/                # UX audit, heuristics, and design docs
│   ├── user-journeys/        # L2 user journey and component maps
│   └── 05_Database_Schema_Design.md
│
├── archive/
│   └── 2026-07/              # Files archived July 2026 (see ARCHIVE_MANIFEST.md)
│
├── .gitignore
├── README.md
└── CHANGELOG.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- pdfplumber, pandas (install via pip)

### Backend

```bash
cd project-manager/backend
npm install
node server.js
```

Server runs on `http://localhost:3001`.

### Frontend

```bash
cd project-manager/frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`.

### PDF Extraction

Run the extraction pipeline from `scripts/pdf-extraction/`:

```bash
python scripts/pdf-extraction/pdfplumber_extract.py
```

Or open the Jupyter notebooks in `notebooks/` for interactive exploration.

---

## Data Organization

| Folder | Contents |
|--------|----------|
| `data/app12/` | G702/G703 line items and cover page for Pay App 12 |
| `data/app13/` | G702/G703 line items for Pay App 13 |
| `data/other-apps/` | Extracted data for Pay Apps 2–8 |
| `data/subcontractors/` | Subcontractor schedule of values (Excel + CSV) |

---

## Documentation

| Document | Location |
|----------|----------|
| Database Schema | [docs/05_Database_Schema_Design.md](docs/05_Database_Schema_Design.md) |
| Business Requirements | [docs/brd/](docs/brd/) |
| UX Audit & Design | [docs/ui-ux/](docs/ui-ux/) |
| User Journeys | [docs/user-journeys/](docs/user-journeys/) |
