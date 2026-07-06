# JV Pay Application - V2

> 🚀 **AI-Powered Construction Payment Application Processing System**

A modern microservices application featuring **LangGraph multi-agent orchestration** for automated extraction and processing of construction payment applications (AIA G702/G703 forms).

---

## 🤖 For AI Agents - READ THIS FIRST!

**Before performing any task, read these files:**

1. 📄 [`.ai-context.md`](.ai-context.md) - **Which folders to use/ignore**
2. 📁 [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) - **Complete folder structure**
3. ⚡ [`.aidigest`](.aidigest) - **Quick reference**

**Key Rule:** Work with `frontend/`, `api-gateway/`, `ai-engine/` ONLY. Ignore `project-manager/` and `_archive/`.

---

## 📤 Sharing This Project

**If you want to share this with a team member:**

1. 📖 Read [`SHARING_SUMMARY.md`](SHARING_SUMMARY.md) - **Complete guide for sharing**
2. ✅ Follow [`PRE_PUSH_CHECKLIST.md`](PRE_PUSH_CHECKLIST.md) - **Security checks before pushing**
3. 📧 Give them [`SETUP_GUIDE.md`](SETUP_GUIDE.md) - **Setup instructions for new developers**
4. 🔐 Send credentials via secure channel (see SHARING_SUMMARY.md)

---

## 🎯 Quick Start

```powershell
# Start all services (recommended)
docker-compose up

# OR start individually for development:

# Terminal 1: AI Engine (Python FastAPI + LangGraph)
cd ai-engine
..\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (React + TypeScript + Vite)
cd frontend
npm run dev

# Then open: http://localhost:5173
```

---

## 📁 V2 Architecture - Microservices

```
/ (THIS IS V2 - READ .ai-context.md FOR AGENT INSTRUCTIONS)
├── frontend/                 ← React TypeScript Web App (Port 5173)
│   ├── src/
│   │   ├── App.tsx          # Main application entry
│   │   ├── components/      # UI components
│   │   ├── pages/           # Route pages
│   │   └── contexts/        # React contexts
│   └── package.json
│
├── api-gateway/              ← TypeScript API Gateway (Port 3001)
│   ├── src/
│   │   ├── index.ts         # Express server
│   │   ├── routes/          # REST endpoints
│   │   ├── lib/             # Utilities
│   │   └── middleware/      # Auth, CORS, etc.
│   ├── prisma/
│   │   └── schema.prisma    # SQL Server schema
│   └── package.json
│
├── ai-engine/                ← Python AI Engine (Port 8000)
│   ├── app/
│   │   ├── main.py          # FastAPI server
│   │   ├── graph/           # LangGraph agents
│   │   │   ├── workflow.py  # Main orchestration
│   │   │   └── nodes/       # Agent nodes
│   │   ├── config.py        # Configuration
│   │   └── __init__.py
│   └── requirements.txt
│
├── Docs/
│   └── version-2-documentation/
│       └── 09-langgraph-architecture-diagrams.html  ← Architecture diagrams (20 sections)
│
├── data/                     ← Extracted payment app data (CSV, JSON)
│   ├── app12/               # Pay Application #12
│   ├── app13/               # Pay Application #13
│   └── subcontractors/      # Subcontractor schedules
│
├── notebooks/                ← Jupyter notebooks for R&D
│   ├── gc_app12_extractor.ipynb
│   ├── invoice_extractor.ipynb
│   └── subcontractor_extractor.ipynb
│
├── scripts/                  ← Utility scripts
│   ├── pdf-extraction/      # PDF processing scripts
│   └── data-push/           # Data migration scripts
│
├── docker-compose.yml        ← Orchestrates all services
├── .ai-context.md            ← **AI AGENT INSTRUCTIONS** (READ THIS FIRST!)
├── README.md                 ← This file
│
└── _archive/                 ← ⚠️ OLD/DEPRECATED CODE (DO NOT USE)
    ├── 2026-07/             # Archived July files
    ├── extraction-script-legacy/  # Old extraction scripts
    └── project-manager-v1/  # V1 Node.js app (DEPRECATED)
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

## 🤖 V2 Multi-Agent Architecture

**LangGraph Orchestration with 10+ Intelligent Agents**

### Agent Hierarchy:
- **🎯 Manager Agent** (Tier 1): Orchestrator with construction domain expertise
- **🤖 Core Agents** (Tier 2): Extraction, Quality Review, Reconciliation
- **🔍 Helper Agents** (Tier 3): OCR, Table Parser, Math Validator, Lien Waiver, Materials Auditor, Previous App Comparator
- **⚡ Custom Agents** (Tier 4): Dynamically created for new document patterns

### Key Features:
- ✅ **Fault Tolerance**: PostgreSQL checkpointing - automatic crash recovery
- ✅ **Natural Language Logging**: Copilot-style agent narration in real-time chat
- ✅ **3-Tier Guardrails**: BLOCK (critical), FLAG (review), AUTO-FIX (minor)
- ✅ **Human-in-the-Loop**: Indefinite pause for user input (no timeouts)
- ✅ **Custom Agent Governance**: User approval required for new agents
- ✅ **State Management**: 6-phase checkpointing across workflow

📊 **View Complete Architecture:**  
Open `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html` in browser (20 comprehensive diagrams)

---

## 🚀 Getting Started (V2)

### Prerequisites

- **Docker** (recommended) OR:
- Node.js 20+
- Python 3.11+
- PostgreSQL 16+ (for LangGraph checkpoints)
- Azure OpenAI access

### Option 1: Docker (Recommended)

```powershell
# Start all services: SQL Server, PostgreSQL, Azurite, API Gateway, AI Engine, Frontend
docker-compose up

# Access:
# - Frontend: http://localhost:5173
# - AI Engine: http://localhost:8000/docs (Swagger)
# - API Gateway: http://localhost:3001
```

### Option 2: Local Development

#### 1. AI Engine (Python)
```powershell
cd ai-engine

# Create virtual environment (first time only)
python -m venv ..\.venv
..\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Azure OpenAI keys

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend (React + TypeScript)
```powershell
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Open: http://localhost:5173
```

#### 3. API Gateway (Optional - for SQL Server features)
```powershell
cd api-gateway

npm install
npm run dev

# Runs on: http://localhost:3001
```

---

## 📊 Data Organization

| Folder | Contents |
|--------|----------|
| `data/app12/` | G702/G703 line items and cover page for Pay App 12 |
| `data/app13/` | G702/G703 line items for Pay App 13 |
| `data/other-apps/` | Extracted data for Pay Apps 2–8 |
| `data/subcontractors/` | Subcontractor schedule of values (Excel + CSV) |

---

## 📚 Documentation

| Document | Location |
|----------|----------|
| **🤖 AI Agent Instructions** | `.ai-context.md` (READ THIS FIRST!) |
| **🏗️ V2 Architecture Diagrams** | `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html` |
| Database Schema | `api-gateway/prisma/schema.prisma` |
| Business Requirements | `Docs/brd/` |
| UX Design | `Docs/ui-ux-assesment/` |
| Sprint Plans | `Docs/implementation-plan/` |

---

## 🧪 Testing & Development

```powershell
# Test AI Engine
cd ai-engine
pytest

# Test Frontend
cd frontend
npm run test

# E2E Tests (future)
npm run test:e2e
```

---

## 🔧 Technology Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS 4
- React Router v7
- React Query (data fetching)
- Zustand (state management)

### API Gateway
- TypeScript + Express
- Prisma (SQL Server ORM)
- Azure Blob Storage SDK

### AI Engine
- Python 3.11
- FastAPI
- LangGraph (agent orchestration)
- Azure OpenAI (GPT-4 Vision)
- Azure Document Intelligence
- PostgreSQL (checkpointing)

### Infrastructure
- Docker + Docker Compose
- Azure SQL Server
- PostgreSQL 16
- Azurite (Azure Blob emulator)

---

## 📝 Environment Variables

### AI Engine (`.env`)
```env
# Azure OpenAI
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-vision
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# PostgreSQL (LangGraph checkpoints)
POSTGRES_DSN=postgresql://postgres:postgres@localhost:5432/jvpay

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER_NAME=jvpay-docs
```

### API Gateway (`.env`)
```env
DATABASE_URL=sqlserver://localhost:1433;database=jvpay;...
AZURE_STORAGE_CONNECTION_STRING=...
AI_ENGINE_URL=http://localhost:8000
```

---

## 🤝 Contributing

This is V2 architecture. All new development should target:
- `frontend/` (React app)
- `api-gateway/` (TypeScript API)
- `ai-engine/` (LangGraph agents)

**DO NOT modify:**
- `_archive/project-manager-v1/` (old V1 code)
- `_archive/extraction-script-legacy/` (replaced by ai-engine)

---

## 📦 Deployment

```powershell
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to Azure Container Apps (future)
# See: Docs/deployment/azure-deployment.md
```

---

## 🐛 Troubleshooting

### "Cannot connect to AI Engine"
- Check AI Engine is running: `http://localhost:8000/health`
- Verify environment variables in `ai-engine/.env`

### "Frontend blank screen"
- Check browser console for errors
- Verify frontend dev server: `cd frontend && npm run dev`

### "LangGraph checkpoint errors"
- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Check connection string in `.env`

---

## 📞 Support

**Architecture Questions:** See `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`  
**Agent Instructions:** See `.ai-context.md`  
**Development:** Check `CHANGELOG.md` for recent changes

---

**Version:** 2.0 (LangGraph Multi-Agent)  
**Status:** Active Development  
**Last Updated:** 2026-07-06
