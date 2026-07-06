# ✅ Pre-Push Checklist & Friend Setup Instructions

> **Before you push to GitHub and share with your friend**

---

## 📋 STEP 1: Pre-Push Checklist (Do This BEFORE `git push`)

Run through this checklist to ensure no credentials are exposed:

### **A. Verify .env Files Are Ignored**

```powershell
# Check that .env files are in .gitignore
Get-Content .gitignore | Select-String ".env"

# Verify .env files are NOT staged
git status

# If you see .env files in git status, run:
git rm --cached ai-engine/.env
git rm --cached api-gateway/.env
```

**Expected:** `.env` files should NOT appear in `git status`

---

### **B. Verify No Credentials in Code**

```powershell
# Search for potential exposed API keys
git grep -i "AZURE_OPENAI_API_KEY" -- ':!.env' ':!.env.example'
git grep -i "AccountKey=" -- ':!.env' ':!.env.example'
git grep -i "password=" -- ':!.env' ':!.env.example'

# Should return NO results (except in .env.example which has placeholders)
```

**Expected:** No matches in tracked files

---

### **C. Verify Sanitized Example Files**

```powershell
# Check that .env.example files don't have real keys
Get-Content ai-engine\.env.example | Select-String "YOUR_"
Get-Content api-gateway\.env.example | Select-String "YOUR_"
```

**Expected:** Should see "YOUR_AZURE_OPENAI_API_KEY_HERE" (placeholders), not real keys

---

### **D. Check for Credentials File**

```powershell
# Verify CREDENTIALS_TEMPLATE_FOR_SHARING.md is gitignored
git check-ignore CREDENTIALS_TEMPLATE_FOR_SHARING.md
```

**Expected:** Should return `CREDENTIALS_TEMPLATE_FOR_SHARING.md` (meaning it's ignored)

---

### **E. Final Git Status Check**

```powershell
git status
```

**Expected output (should NOT include):**
- ❌ `ai-engine/.env`
- ❌ `api-gateway/.env`
- ❌ `CREDENTIALS_TEMPLATE_FOR_SHARING.md`
- ❌ Any files with real API keys

**Expected output (should include):**
- ✅ `ai-engine/.env.example` (sanitized)
- ✅ `api-gateway/.env.example` (sanitized)
- ✅ `SETUP_GUIDE.md`
- ✅ `.gitignore`
- ✅ Other code files

---

## ✅ If All Checks Pass → Safe to Push!

```powershell
git add .
git commit -m "Add setup documentation and sanitized env examples"
git push origin main
```

---

## 📧 STEP 2: What to Send Your Friend

Your friend needs **2 things** to run the application:

### **Thing 1: GitHub Repository URL**

Share the repository link:
```
https://github.com/YOUR_USERNAME/YOUR_REPO_NAME
```

### **Thing 2: Credentials (SEND SEPARATELY via secure channel)**

**⚠️ DO NOT send credentials via:**
- ❌ GitHub (issues, wiki, README)
- ❌ Public Slack/Discord
- ❌ Regular email
- ❌ Text message

**✅ SEND credentials via:**
- ✅ Encrypted email (ProtonMail, Tutanota)
- ✅ Secure messaging (Signal, WhatsApp with disappearing messages)
- ✅ Password manager share (1Password, Bitwarden shared vault)
- ✅ In-person USB transfer

**What to send:**
1. Copy `CREDENTIALS_TEMPLATE_FOR_SHARING.md`
2. Fill in the SQL password (replace `<YOUR_SQL_ADMIN_PASSWORD_HERE>`)
3. Send via secure channel above
4. Tell your friend to:
   - Save it somewhere safe (NOT in the Git repo)
   - Copy values into their `.env` files
   - Delete the credentials file after copying

---

## 📝 STEP 3: Friend's Setup Instructions

Send your friend this message:

---

### **📧 Message Template:**

```
Hi [Friend Name],

I've shared the JV Pay V2 application repo with you:
Repository: [YOUR_GITHUB_URL]

To get started:

1. Clone the repo:
   git clone [YOUR_GITHUB_URL]
   cd [REPO_NAME]

2. Read SETUP_GUIDE.md for complete setup instructions

3. I'll send you Azure credentials separately via [secure channel]

4. Follow the setup guide - it has everything you need

Let me know if you run into any issues!
```

---

**Then send credentials separately via secure channel** (see "Thing 2" above)

---

## 🔒 STEP 4: Post-Push Security

After pushing to GitHub:

### **A. Verify Repository is Secure**

1. Go to your GitHub repository
2. Check recent commits - no `.env` files should appear
3. Search repository for "AZURE_OPENAI_API_KEY" - should only find `.env.example`
4. Verify `CREDENTIALS_TEMPLATE_FOR_SHARING.md` is NOT visible

### **B. Set Repository to Private (Recommended)**

```powershell
# If you haven't already, make the repo private on GitHub:
# GitHub → Your Repo → Settings → Danger Zone → Change visibility → Private
```

**Why:** Even without credentials, your architecture and business logic may be proprietary

### **C. Add Collaborator (Your Friend)**

```powershell
# GitHub → Your Repo → Settings → Collaborators → Add people
# Enter your friend's GitHub username
```

---

## 🆘 Emergency: If You Accidentally Pushed Credentials

**If you pushed `.env` files or credentials to GitHub:**

### **Immediate Actions (within 5 minutes):**

1. **Delete from Git history:**
```powershell
# Remove file from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch ai-engine/.env" --prune-empty --tag-name-filter cat -- --all

# Force push
git push origin --force --all
```

2. **Rotate ALL credentials immediately:**
   - Azure OpenAI: Regenerate keys
   - Document Intelligence: Regenerate keys
   - Storage Account: Regenerate keys
   - SQL Database: Reset password
   - PostgreSQL: Reset password

3. **Update your local `.env` files** with new credentials

4. **Notify your friend** to update their `.env` files

### **Prevention:**

- Use `git-secrets` tool to prevent accidental commits
- Set up pre-commit hooks
- Always run checklist before `git push`

---

## 📊 Quick Reference

| What | Where to Find It | Who Needs It |
|------|------------------|--------------|
| **Setup Instructions** | `SETUP_GUIDE.md` | Your friend |
| **Credentials** | Send separately (secure channel) | Your friend |
| **Repo URL** | GitHub repository link | Your friend |
| **Architecture Docs** | `Docs/version-2-documentation/` | Both |
| **Troubleshooting** | `SETUP_GUIDE.md` section | Your friend |

---

## ✅ Final Checklist

Before you consider this done:

- [ ] ✅ Ran all pre-push security checks above (STEP 1)
- [ ] ✅ No credentials in Git (`git status` is clean)
- [ ] ✅ `.env.example` files are sanitized
- [ ] ✅ `CREDENTIALS_TEMPLATE_FOR_SHARING.md` is git-ignored
- [ ] ✅ Pushed to GitHub (`git push origin main`)
- [ ] ✅ Verified no credentials visible on GitHub
- [ ] ✅ Sent repository URL to friend
- [ ] ✅ Sent credentials via secure channel (separate from repo URL)
- [ ] ✅ Deleted `CREDENTIALS_TEMPLATE_FOR_SHARING.md` from local machine (after sending)
- [ ] ✅ Repository is private (recommended)
- [ ] ✅ Friend added as collaborator on GitHub

---

## 🎉 You're Done!

Your friend now has everything they need:
1. ✅ Repository access (can `git clone`)
2. ✅ Setup instructions (`SETUP_GUIDE.md`)
3. ✅ Credentials (sent securely)
4. ✅ Architecture docs (in repo)

They can follow `SETUP_GUIDE.md` and be up and running in 15-30 minutes!

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-06  
**Security Level:** Critical - Keep this checklist for future reference
