# Contributing to JV Pay V2

## 🎯 V2 Development - Where to Work

**Active Development Folders (V2):**
- ✅ `frontend/` - React TypeScript web app
- ✅ `api-gateway/` - TypeScript API Gateway
- ✅ `ai-engine/` - Python LangGraph AI engine
- ✅ `Docs/version-2-documentation/` - Architecture documentation

**DO NOT Modify:**
- ❌ `_archive/project-manager-v1/` - Old V1 Node.js app (DEPRECATED)
- ❌ `_archive/extraction-script-legacy/` - Old extraction scripts
- ❌ `_archive/2026-07/` - Archived legacy files

---

## 📋 Development Workflow

### 1. Before Starting Work
```powershell
# Always start by reading the AI context
cat .ai-context.md

# Pull latest changes
git pull origin main

# Check what's running
docker ps
```

### 2. Making Changes

**Frontend Development:**
```powershell
cd frontend
npm run dev
# Edit files in frontend/src/
```

**AI Engine Development:**
```powershell
cd ai-engine
..\.venv\Scripts\activate
uvicorn app.main:app --reload
# Edit files in ai-engine/app/
```

**API Gateway Development:**
```powershell
cd api-gateway
npm run dev
# Edit files in api-gateway/src/
```

### 3. Testing Changes
```powershell
# AI Engine tests
cd ai-engine
pytest

# Frontend tests  
cd frontend
npm run test

# Manual testing
docker-compose up
# Open http://localhost:5173
```

### 4. Committing Changes
```powershell
git add <files>
git commit -m "feat: descriptive message"
git push origin your-branch
```

---

## 🏗️ Architecture Guidelines

### Frontend (React + TypeScript)
- Use TypeScript for all new files
- Follow React functional component pattern
- Use TailwindCSS for styling (no inline styles)
- Store reusable components in `components/shared/`
- Use React Query for server state
- Use Zustand for client state

### AI Engine (Python + LangGraph)
- Follow PEP 8 style guide
- Add type hints to all functions
- Place agent logic in `app/graph/nodes/`
- Add new tools to respective agent modules
- Document all agent prompts
- Write tests for new agent nodes

### API Gateway (TypeScript + Express)
- Use Prisma for database queries
- Add new routes in `src/routes/`
- Validate input with middleware
- Return consistent error responses
- Document API endpoints

---

## 📁 File Organization

### Adding New Features

**New Agent:**
```
ai-engine/app/graph/nodes/
└── my_new_agent_node.py      # Agent implementation
```

**New Frontend Page:**
```
frontend/src/
├── pages/
│   └── MyNewPage.tsx          # Page component
├── components/
│   └── MyNewComponent.tsx     # Supporting component
```

**New API Endpoint:**
```
api-gateway/src/routes/
└── my-new-route.ts            # Route handler
```

---

## 🔍 Code Review Checklist

- [ ] Code follows project structure (see `.ai-context.md`)
- [ ] No changes to `_archive/` folders
- [ ] TypeScript: No `any` types
- [ ] Python: Type hints added
- [ ] Tests written for new features
- [ ] Documentation updated if needed
- [ ] Environment variables added to `.env.example`
- [ ] No hardcoded secrets or API keys

---

## 🚫 Common Mistakes to Avoid

1. ❌ Working in `_archive/project-manager-v1/` instead of V2 folders
2. ❌ Mixing V1 and V2 code
3. ❌ Committing `.env` files with secrets
4. ❌ Hardcoding localhost URLs (use environment variables)
5. ❌ Adding dependencies without updating requirements.txt or package.json

---

## 📚 Resources

- **Architecture:** Open `Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`
- **AI Context:** Read `.ai-context.md` before any agent work
- **LangGraph Docs:** https://langchain-ai.github.io/langgraph/
- **React Query Docs:** https://tanstack.com/query/latest
- **Prisma Docs:** https://www.prisma.io/docs

---

## ❓ Questions?

1. **Where do I add a new agent?** → `ai-engine/app/graph/nodes/`
2. **Where do I add a new UI page?** → `frontend/src/pages/`
3. **Where do I add a new API endpoint?** → `api-gateway/src/routes/`
4. **Which folder is V2?** → Read `.ai-context.md` (frontend/, api-gateway/, ai-engine/)
5. **Can I modify project-manager/?** → NO! It's archived in `_archive/`

---

**Remember:** Always check `.ai-context.md` when unsure which application/folder to work in!
