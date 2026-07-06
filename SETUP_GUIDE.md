# 🚀 JV Pay Application V2 - Setup Guide for New Developers

> **Give this document to anyone who needs to run the application**  
> **Last Updated:** 2026-07-06

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Clone the Repository](#-clone-the-repository)
3. [Environment Variables Setup](#-environment-variables-setup)
4. [Installation Steps](#-installation-steps)
5. [Running the Application](#-running-the-application)
6. [Troubleshooting](#-troubleshooting)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Download Link |
|------|---------|---------------|
| **Node.js** | 18.x or higher | https://nodejs.org/ |
| **Python** | 3.11 or higher | https://www.python.org/downloads/ |
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop/ |
| **Git** | Latest | https://git-scm.com/ |
| **VS Code** (recommended) | Latest | https://code.visualstudio.com/ |

**Check your installations:**
```powershell
node --version    # Should be v18.x or higher
python --version  # Should be 3.11.x or higher
docker --version  # Should be 20.x or higher
git --version
```

---

## 📥 Clone the Repository

```powershell
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>

# Navigate to the project folder
cd Ishaan

# Verify you're in the right place
ls
# You should see: frontend/, api-gateway/, ai-engine/, docker-compose.yml
```

---

## 🔐 Environment Variables Setup

The application requires Azure credentials and configuration. **I will provide these separately for security.**

### **Step 1: Create Environment Files**

You need to create **2 environment files** from the provided templates:

#### **1. AI Engine Environment (`ai-engine/.env`)**

```powershell
# Copy the example file
Copy-Item "ai-engine\.env.example" -Destination "ai-engine\.env"

# Open it in VS Code
code ai-engine\.env
```

**Replace the following values with the credentials I provide:**

```env
# Service URLs (keep as-is for local development)
AI_ENGINE_URL=http://localhost:8000
API_GATEWAY_URL=http://localhost:3001

# ⚠️ REPLACE THESE - I will provide actual values
AZURE_OPENAI_ENDPOINT=<YOUR_AZURE_OPENAI_ENDPOINT>
AZURE_OPENAI_API_KEY=<YOUR_AZURE_OPENAI_KEY>
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT_GPT4O=gpt-5.4
AZURE_OPENAI_DEPLOYMENT_GPT4O_MINI=gpt-5.4

# ⚠️ REPLACE THESE - Azure Document Intelligence
DOC_INTEL_ENDPOINT=<YOUR_DOC_INTEL_ENDPOINT>
DOC_INTEL_API_KEY=<YOUR_DOC_INTEL_KEY>

# ⚠️ REPLACE THESE - Azure Storage (Blob)
AZURE_STORAGE_CONNECTION_STRING=<YOUR_STORAGE_CONNECTION_STRING>
AZURE_STORAGE_CONTAINER_NAME=jvpay-docs

# ⚠️ REPLACE THIS - PostgreSQL (for LangGraph checkpointing)
POSTGRES_DSN=<YOUR_POSTGRES_CONNECTION_STRING>

# Optional: LangSmith tracing (leave false for now)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=jv-pay-v2

# Poppler (leave blank on Windows - uses system PATH)
POPPLER_PATH=
```

---

#### **2. API Gateway Environment (`api-gateway/.env`)**

```powershell
# Copy the example file
Copy-Item "api-gateway\.env.example" -Destination "api-gateway\.env"

# Open it in VS Code
code api-gateway\.env
```

**Replace the following values:**

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# ⚠️ REPLACE THIS - Azure SQL Database
DATABASE_URL="sqlserver://<SERVER>.database.windows.net:1433;database=jvpay;user=<USERNAME>;password=<PASSWORD>;encrypt=true;trustServerCertificate=false"

# ⚠️ REPLACE THIS - Azure Storage (same as AI Engine)
AZURE_STORAGE_CONNECTION_STRING=<YOUR_STORAGE_CONNECTION_STRING>
AZURE_STORAGE_CONTAINER_NAME=jvpay-docs

# Azure AD (optional - for Sprint 14 authentication)
AZURE_TENANT_ID=<YOUR_TENANT_ID>
AZURE_CLIENT_ID=<YOUR_CLIENT_ID>

# Python AI Engine URL (keep as-is for local development)
AI_ENGINE_URL=http://localhost:8000

# LangSmith (optional)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
```

---

### **📧 Request Credentials from Me**

**I will send you a separate secure message with:**

1. ✅ `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`
2. ✅ `DOC_INTEL_ENDPOINT` and `DOC_INTEL_API_KEY`
3. ✅ `AZURE_STORAGE_CONNECTION_STRING`
4. ✅ `POSTGRES_DSN` (PostgreSQL connection string)
5. ✅ `DATABASE_URL` (Azure SQL connection string)

**Copy those values into your `.env` files.**

---

## 📦 Installation Steps

### **Option 1: Quick Start with Docker (Recommended)**

```powershell
# Start all services (database, API, AI engine, frontend)
docker-compose up

# Wait for services to start (takes 1-2 minutes first time)
# You should see:
# ✅ PostgreSQL running
# ✅ AI Engine running on port 8000
# ✅ API Gateway running on port 3001
# ✅ Frontend running on port 5173
```

**Access the application:**
- **Frontend:** http://localhost:5173
- **AI Engine API Docs:** http://localhost:8000/docs
- **API Gateway:** http://localhost:3001

---

### **Option 2: Manual Setup (For Development)**

If you want to run services individually for debugging:

#### **Step 1: Install Python Dependencies**

```powershell
# Navigate to AI Engine
cd ai-engine

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Go back to root
cd ..
```

#### **Step 2: Install Node.js Dependencies**

```powershell
# Install API Gateway dependencies
cd api-gateway
npm install
cd ..

# Install Frontend dependencies
cd frontend
npm install
cd ..
```

#### **Step 3: Database Setup (Prisma)**

```powershell
cd api-gateway

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

cd ..
```

---

## ▶️ Running the Application

### **Option 1: Docker (All Services at Once)**

```powershell
# Start all services
docker-compose up

# Or run in background
docker-compose up -d

# Stop all services
docker-compose down
```

---

### **Option 2: Manual (Individual Terminals)**

Open **3 separate terminal windows:**

#### **Terminal 1: AI Engine (Python + FastAPI)**

```powershell
cd ai-engine
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### **Terminal 2: Frontend (React + Vite)**

```powershell
cd frontend
npm run dev
```

#### **Terminal 3: API Gateway (Optional - if using database features)**

```powershell
cd api-gateway
npm run dev
```

---

## 🌐 Access the Application

After starting the services:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Main user interface |
| **AI Engine** | http://localhost:8000 | LangGraph multi-agent API |
| **AI Engine Docs** | http://localhost:8000/docs | FastAPI Swagger docs |
| **API Gateway** | http://localhost:3001 | REST API + Database |

---

## 🧪 Test the Setup

### **1. Check AI Engine Health**

```powershell
# In PowerShell
Invoke-RestMethod http://localhost:8000/health
```

**Expected output:**
```json
{
  "status": "healthy",
  "azure_openai": "connected",
  "doc_intel": "connected",
  "blob_storage": "connected"
}
```

### **2. Check Frontend**

- Open http://localhost:5173 in your browser
- You should see the JV Pay Application home page

### **3. Test File Upload**

- Upload a sample PDF (I can provide test files)
- The AI agents should start processing automatically

---

## ❌ Troubleshooting

### **Problem: `ModuleNotFoundError` in AI Engine**

**Solution:**
```powershell
cd ai-engine
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### **Problem: `ECONNREFUSED` to database**

**Solution:**
- Check your `DATABASE_URL` in `api-gateway/.env`
- Verify Azure SQL firewall allows your IP
- Test connection: `npx prisma db push`

### **Problem: Azure OpenAI errors**

**Solution:**
- Check `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` in `ai-engine/.env`
- Verify the API key is valid
- Check deployment name matches (`gpt-5.4`)

### **Problem: `Cannot find module 'prisma'`**

**Solution:**
```powershell
cd api-gateway
npm install
npx prisma generate
```

### **Problem: Port already in use**

**Solution:**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### **Problem: Docker containers not starting**

**Solution:**
```powershell
# Stop all containers
docker-compose down

# Remove volumes and restart
docker-compose down -v
docker-compose up --build
```

---

## 📁 Project Structure Reference

```
/ (Root - JV Pay Application V2)
├── frontend/          ← React app (Port 5173)
├── api-gateway/       ← Express API (Port 3001)
├── ai-engine/         ← Python + LangGraph (Port 8000)
├── docker-compose.yml ← Orchestration
├── .ai-context.md     ← AI agent instructions
└── Docs/              ← Architecture documentation
```

**Read these for more info:**
- [`.ai-context.md`](.ai-context.md) - Quick start
- [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) - Complete structure
- [`Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`](Docs/version-2-documentation/09-langgraph-architecture-diagrams.html) - Architecture (20 diagrams)

---

## 🔒 Security Notes

**⚠️ IMPORTANT:**

1. ❌ **NEVER commit `.env` files to Git** (they're in `.gitignore`)
2. ❌ **NEVER share API keys publicly**
3. ✅ **Always use environment variables** for secrets
4. ✅ **Rotate keys if exposed**

**If you accidentally expose credentials:**
1. Immediately rotate the keys in Azure Portal
2. Update your `.env` files
3. Notify me

---

## 📞 Need Help?

**If you encounter issues:**

1. Check [Troubleshooting](#-troubleshooting) section above
2. Read [`REORGANIZATION_SUMMARY.md`](REORGANIZATION_SUMMARY.md) for workspace structure
3. Review error logs in terminal
4. Contact me with:
   - Error message
   - What you were doing
   - Terminal output
   - Screenshot (if UI issue)

---

## ✅ Verification Checklist

Before you start coding, verify:

- [ ] ✅ Node.js 18+ installed
- [ ] ✅ Python 3.11+ installed
- [ ] ✅ Docker Desktop running
- [ ] ✅ Repository cloned
- [ ] ✅ `.env` files created in `ai-engine/` and `api-gateway/`
- [ ] ✅ Environment variables populated (I sent you the values)
- [ ] ✅ Dependencies installed (`npm install` in frontend/ and api-gateway/, `pip install -r requirements.txt` in ai-engine/)
- [ ] ✅ Application running (http://localhost:5173 loads)
- [ ] ✅ Health check passes (http://localhost:8000/health returns `healthy`)

**Run this to verify workspace structure:**
```powershell
.\verify-structure-v2.ps1
```

---

## 🎉 You're Ready!

Once all checkboxes are ✅, you're ready to start developing!

**Next steps:**
1. Read architecture: [`Docs/version-2-documentation/09-langgraph-architecture-diagrams.html`](Docs/version-2-documentation/09-langgraph-architecture-diagrams.html)
2. Explore the code in VS Code
3. Try uploading a test PDF to see agents in action
4. Review [`CONTRIBUTING.md`](CONTRIBUTING.md) for development guidelines

**Happy coding! 🚀**

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-06  
**Maintained by:** Project Team
