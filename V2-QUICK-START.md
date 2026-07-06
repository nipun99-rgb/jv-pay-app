# 🎯 V2 Application - Quick Reference

> **For ANY AI Agent:** Read this file OR `.ai-context.md` to understand the V2 structure!

---

## ✅ What Just Happened?

Your repository has been **reorganized using industry standards**:

1. ✅ **V2 folders clearly identified** (frontend/, api-gateway/, ai-engine/)
2. ✅ **Old V1 code archived** (_archive/project-manager-v1/)
3. ✅ **Legacy scripts archived** (_archive/extraction-script-legacy/)
4. ✅ **AI context file created** (.ai-context.md)
5. ✅ **Documentation updated** (README.md, CONTRIBUTING.md)

---

## 🚀 THE V2 APPLICATION (Active Development)

```
V2 Structure:
├── frontend/          ← React + TypeScript + Vite (Port 5173)
├── api-gateway/       ← TypeScript API Gateway (Port 3001)
├── ai-engine/         ← Python + LangGraph AI (Port 8000)
└── docker-compose.yml ← Start all services
```

**Start V2 Application:**
```powershell
docker-compose up
# OR for local dev:
cd ai-engine; ..\.venv\Scripts\activate; uvicorn app.main:app --reload
cd frontend; npm run dev
```

**Access:** http://localhost:5173

---

## 📂 What's Where?

| What You Need | Where to Find It |
|---------------|------------------|
| **Start application** | `docker-compose up` |
| **Frontend code** | `frontend/src/` |
| **AI agents** | `ai-engine/app/graph/nodes/` |
| **API endpoints** | `api-gateway/src/routes/` |
| **Architecture diagrams** | `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html` |
| **AI agent instructions** | `.ai-context.md` |
| **Development guide** | `CONTRIBUTING.md` |

---

## ❌ What NOT to Use

```
_archive/                          ← OLD CODE - IGNORE
├── project-manager-v1/           ← Old V1 Node.js app (DEPRECATED)
├── extraction-script-legacy/     ← Old Python scripts (DEPRECATED)
└── 2026-07/                      ← Archived July files
```

**If ANY agent suggests opening these folders → REDIRECT to V2!**

---

## 🤖 For AI Agents

**When user says "open the application":**
1. Read `.ai-context.md` file
2. Open `frontend/` for UI work
3. Open `ai-engine/` for agent work
4. Open `api-gateway/` for API work
5. **NEVER** open `_archive/project-manager-v1/`

**When user says "start the app":**
```powershell
docker-compose up
# Then open: http://localhost:5173
```

---

## ✅ Verification

Run this to verify structure:
```powershell
.\verify-structure.ps1
```

Should show: "🎉 SUCCESS! V2 application structure is correct!"

---

## 📚 Important Files to Read

1. **`.ai-context.md`** ← AI agent instructions (MOST IMPORTANT)
2. **`README.md`** ← Project overview and quick start
3. **`CONTRIBUTING.md`** ← Development guidelines
4. **`Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`** ← Complete architecture

---

## 🔄 What Changed?

### Before (Confusing):
```
/
├── project-manager/  ← V1 app (old)
├── frontend/         ← V2 frontend (new)
├── ai-engine/        ← V2 AI (new)
└── extraction-script/ ← Legacy scripts
```
**Problem:** Multiple apps, unclear which is V2!

### After (Clear):
```
/
├── frontend/         ← V2 Frontend ✅
├── api-gateway/      ← V2 API ✅
├── ai-engine/        ← V2 AI Engine ✅
├── .ai-context.md    ← AI instructions ✅
└── _archive/         ← Old code (archived)
    ├── project-manager-v1/
    └── extraction-script-legacy/
```
**Solution:** Clear V2 structure, old code archived!

---

## 🎓 Industry Standards Applied

✅ **Monorepo Structure** - All V2 services in one repository  
✅ **Clear Naming** - frontend/, api-gateway/, ai-engine/ (descriptive)  
✅ **Archive Pattern** - Old code in `_archive/` (not deleted, just separated)  
✅ **Documentation** - Multiple README files for context  
✅ **AI Context File** - `.ai-context.md` tells agents what's what  
✅ **Verification Script** - `verify-structure.ps1` confirms correctness  

---

## 🚦 Next Steps

1. **Read `.ai-context.md`** - Understand V2 structure
2. **Run `.\verify-structure.ps1`** - Confirm setup
3. **Start application** - `docker-compose up`
4. **Open frontend** - http://localhost:5173
5. **View architecture** - Open `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html` in browser

---

**Version:** 2.0 (LangGraph Multi-Agent)  
**Reorganized:** 2026-07-06  
**Status:** ✅ Production-Ready Structure  

**Now ANY agent knows which application to open!** 🎉
