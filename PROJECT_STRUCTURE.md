# 📁 Project Structure - JV Pay Application V2

> **Last Updated:** 2026-07-06  
> **Version:** 2.0 (Multi-Agent LangGraph Architecture)  
> **Status:** ✅ Active Development

---

## 🎯 Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| **Start the application** | Run `docker-compose up` or see [Quick Start](#-quick-start) |
| **Edit frontend code** | [`frontend/src/`](frontend/src/) |
| **Modify AI agents** | [`ai-engine/app/graph/nodes/`](ai-engine/app/graph/nodes/) |
| **Add API endpoints** | [`api-gateway/src/routes/`](api-gateway/src/routes/) |
| **View architecture** | [`Docs/version-2-documentation/`](Docs/version-2-documentation/) |
| **Understand V2 structure** | Read [`.ai-context.md`](.ai-context.md) |

---

## ✅ ACTIVE V2 STRUCTURE (USE THESE)

```
/ (Root - JV Pay Application V2)
│
├── 📱 frontend/                      ← React + TypeScript + Vite (Port 5173)
│   ├── src/
│   │   ├── App.tsx                  # Main app component
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Route pages
│   │   ├── contexts/                # React contexts (auth, state)
│   │   └── lib/                     # Utilities
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── 🔌 api-gateway/                   ← TypeScript Express API (Port 3001)
│   ├── src/
│   │   ├── index.ts                 # Express server entry
│   │   ├── routes/                  # REST endpoints
│   │   ├── middleware/              # Auth, CORS, logging
│   │   └── lib/                     # Shared utilities
│   ├── prisma/
│   │   └── schema.prisma            # SQL Server database schema
│   ├── package.json
│   └── tsconfig.json
│
├── 🤖 ai-engine/                     ← Python + FastAPI + LangGraph (Port 8000)
│   ├── app/
│   │   ├── main.py                  # FastAPI application
│   │   ├── config.py                # Azure OpenAI config
│   │   ├── graph/                   # LangGraph multi-agent system
│   │   │   ├── manager_agent.py    # Orchestrator agent
│   │   │   ├── extraction_agent.py # Data extraction
│   │   │   ├── quality_agent.py    # Validation
│   │   │   └── reconciliation_agent.py
│   │   └── nodes/                   # LangGraph nodes
│   ├── requirements.txt
│   └── pyproject.toml
│
├── 📚 Docs/                          ← Documentation
│   ├── version-2-documentation/
│   │   ├── 09-langgraph-architecture-diagrams.html  ← Main architecture doc (20 diagrams)
│   │   ├── 05_Database_Schema_Design.md
│   │   └── Sprint_Implementation_Plan.md
│   ├── brd/                         # Business requirements
│   └── implementation-plan/         # Sprint plans
│
├── 📊 data/                          ← Data files (PDFs, extractions, cache)
│   ├── app12/                       # Payment app 12 data
│   ├── app13/                       # Payment app 13 data
│   ├── cache/                       # OCR/extraction cache
│   └── subcontractors/              # Subcontractor data
│
├── 📓 notebooks/                     ← Jupyter notebooks (prototyping)
│   ├── gc_app12_extractor.ipynb
│   └── invoice_extractor.ipynb
│
├── 🛠️ scripts/                       ← Utility scripts
│   ├── pdf-extraction/              # PDF processing scripts
│   ├── data-push/                   # Data upload scripts
│   └── push_to_github.ps1           # Git automation
│
├── 🐳 docker-compose.yml             ← Orchestrate all services
├── 📖 README.md                      ← Main README (start here!)
├── 📝 .ai-context.md                 ← AI agent instructions
├── 📋 CONTRIBUTING.md                ← Contribution guidelines
├── 📋 CHANGELOG.md                   ← Version history
└── 🔧 .gitignore                     ← Git ignore rules
```

---

## ❌ STALE/ARCHIVED FOLDERS (DO NOT USE)

**These folders contain old V1 code and should NOT be modified:**

```
⚠️ Archived/Deprecated Folders:
│
├── 🗄️ _archive/                      ← Old V1 code (DO NOT USE)
│   ├── project-manager-v1/          # V1 backend (replaced by api-gateway + ai-engine)
│   ├── extraction-script-legacy/    # Old extraction scripts
│   └── README-ARCHIVE.md            # Archive documentation
│
├── 📦 archive/                       ← Active data archives (NOT code)
│   └── 2026-07/                     # July 2026 extraction data (OK to reference)
│
└── 📁 project-manager/               ← STALE: Empty V1 folder (being removed)
    └── backend/                     # Old V1 backend (DO NOT USE)
```

**Why these are archived:**
- `_archive/project-manager-v1/` - V1 monolithic backend replaced by V2 microservices
- `_archive/extraction-script-legacy/` - Old standalone scripts replaced by ai-engine agents
- `project-manager/` - Empty stale folder, safe to delete (locked by process currently)
- `archive/2026-07/` - Data only (PDFs, CSVs), not code - OK to reference for testing

---

## 🚀 Quick Start

### Start V2 Application (All Services)
```powershell
# Start all services with Docker
docker-compose up

# Access:
# - Frontend: http://localhost:5173
# - AI Engine: http://localhost:8000
# - API Gateway: http://localhost:3001
```

### Development Mode (Individual Services)
```powershell
# Terminal 1: AI Engine
cd ai-engine
..\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: API Gateway (optional)
cd api-gateway
npm run dev
```

---

## 🏗️ Architecture Overview

**V2 is a microservices architecture with:**

1. **Frontend** - React SPA for user interface
2. **API Gateway** - REST API + Prisma ORM + SQL Server
3. **AI Engine** - LangGraph multi-agent orchestration
   - Manager Agent (orchestrator)
   - Extraction Agent (data extraction)
   - Quality Agent (validation)
   - Reconciliation Agent (entity matching)
   - 6+ Helper Agents (OCR, Table Parser, etc.)

**See:** [`Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`](Docs/version-2-documentation/09-langgraph-architecture-diagrams.html) for 20 detailed architecture diagrams.

---

## 📊 Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **API Gateway** | Node.js, Express, TypeScript, Prisma |
| **AI Engine** | Python 3.11, FastAPI, LangGraph, LangChain |
| **Database** | Azure SQL Server, PostgreSQL (checkpointing) |
| **AI/ML** | Azure OpenAI (GPT-4), Azure Document Intelligence |
| **Storage** | Azure Blob Storage |
| **Orchestration** | Docker Compose |

---

## 📝 For AI Agents

**When asked to "open the application" or perform tasks:**

1. ✅ **READ** [`.ai-context.md`](.ai-context.md) first
2. ✅ **WORK WITH** `frontend/`, `api-gateway/`, `ai-engine/` only
3. ❌ **IGNORE** `project-manager/`, `_archive/` folders
4. ✅ **REFERENCE** `Docs/version-2-documentation/` for architecture
5. ✅ **START APP** with `docker-compose up` or see Quick Start above

---

## 🔄 Migration Notes (V1 → V2)

**What changed from V1:**

| V1 Component | V2 Replacement | Status |
|--------------|----------------|--------|
| `project-manager/backend/` | `api-gateway/` + `ai-engine/` | ✅ Replaced |
| Manual extraction scripts | LangGraph multi-agent system | ✅ Replaced |
| Monolithic architecture | Microservices (3 services) | ✅ Migrated |
| Single agent | 10+ specialized agents | ✅ Enhanced |
| Basic prompt-based extraction | ReAct pattern + self-validation | ✅ Upgraded |

**V1 code archived to:** `_archive/project-manager-v1/`

---

## 📞 Help & Resources

- **Architecture Diagrams:** [`Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`](Docs/version-2-documentation/09-langgraph-architecture-diagrams.html)
- **Quick Start:** [`V2-QUICK-START.md`](V2-QUICK-START.md)
- **AI Context:** [`.ai-context.md`](.ai-context.md)
- **README:** [`README.md`](README.md)
- **Contributing:** [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

**Last updated:** 2026-07-06  
**Maintained by:** Project Team  
**Industry Standard:** ✅ Follows Microsoft/Google project structure conventions
