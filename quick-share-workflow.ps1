# Quick Commands - Share Application Workflow

# ===== STEP 1: SECURITY CHECK =====

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  STEP 1: Security Pre-Flight Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check for .env files in git
Write-Host "Checking for .env files in git..." -ForegroundColor Yellow
$envInGit = git ls-files | Select-String "\.env$"
if ($envInGit) {
    Write-Host "❌ DANGER: .env files found in git:" -ForegroundColor Red
    $envInGit | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Write-Host "`nRun: git rm --cached ai-engine/.env api-gateway/.env`n" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ No .env files in git (safe)`n" -ForegroundColor Green
}

# Check for exposed API keys
Write-Host "Checking for exposed API keys..." -ForegroundColor Yellow
$exposedKeys = git grep -i "<REDACTED_API_KEY>" 2>$null
if ($exposedKeys) {
    Write-Host "❌ DANGER: Real API keys found in tracked files!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ No exposed API keys in tracked files`n" -ForegroundColor Green
}

# Check .env.example files are sanitized
Write-Host "Checking .env.example files are sanitized..." -ForegroundColor Yellow
$aiExample = Get-Content "ai-engine\.env.example" -Raw
$apiExample = Get-Content "api-gateway\.env.example" -Raw

if ($aiExample -match "YOUR_" -and $apiExample -match "YOUR_") {
    Write-Host "✅ .env.example files are sanitized`n" -ForegroundColor Green
} else {
    Write-Host "❌ WARNING: .env.example files may contain real credentials`n" -ForegroundColor Red
    Write-Host "Check ai-engine\.env.example and api-gateway\.env.example`n" -ForegroundColor Yellow
}

# Check credentials file is ignored
Write-Host "Checking credentials file is git-ignored..." -ForegroundColor Yellow
$isIgnored = git check-ignore CREDENTIALS_TEMPLATE_FOR_SHARING.md 2>$null
if ($isIgnored) {
    Write-Host "✅ Credentials file is properly ignored`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Credentials file might not be ignored`n" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ Security checks PASSED!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# ===== STEP 2: GIT COMMIT & PUSH =====

Write-Host "`nDo you want to commit and push to GitHub? (y/n): " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host

if ($confirm -eq "y") {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  STEP 2: Committing to Git" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    # Show what will be committed
    Write-Host "Files to be committed:" -ForegroundColor Yellow
    git status --short
    
    Write-Host "`nAdding files..." -ForegroundColor Yellow
    git add .
    
    Write-Host "Committing..." -ForegroundColor Yellow
    git commit -m "Add V2 setup documentation and sanitized env examples

- Added SETUP_GUIDE.md for new developers
- Added SHARING_SUMMARY.md with sharing workflow
- Added PRE_PUSH_CHECKLIST.md for security verification
- Sanitized .env.example files (removed real credentials)
- Updated README.md with sharing section
- Updated .gitignore to prevent credential leaks
- Created PROJECT_STRUCTURE.md for workspace layout
- Added .ai-context.md and .aidigest for AI agents
- Removed stale project-manager V1 code"
    
    Write-Host "`nPushing to GitHub..." -ForegroundColor Yellow
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Successfully pushed to GitHub!`n" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Push failed! Check error above.`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`nSkipping commit. You can manually commit later with:" -ForegroundColor Yellow
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'Add setup documentation'" -ForegroundColor White
    Write-Host "  git push origin main`n" -ForegroundColor White
}

# ===== STEP 3: SHARING INSTRUCTIONS =====

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  STEP 3: Share with Your Friend" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next steps to share this application:`n" -ForegroundColor Yellow

Write-Host "1. Send GitHub Repository URL (public channel OK):" -ForegroundColor White
$remoteUrl = git config --get remote.origin.url
if ($remoteUrl) {
    Write-Host "   $remoteUrl`n" -ForegroundColor Cyan
} else {
    Write-Host "   Your GitHub repository URL`n" -ForegroundColor Cyan
}

Write-Host "2. Send credentials via SECURE channel:" -ForegroundColor White
Write-Host "   ⚠️  Open: CREDENTIALS_TEMPLATE_FOR_SHARING.md" -ForegroundColor Yellow
Write-Host "   ⚠️  Fill in SQL password" -ForegroundColor Yellow
Write-Host "   ⚠️  Send via: Signal, encrypted email, or password manager" -ForegroundColor Yellow
Write-Host "   ⚠️  DO NOT send via: Slack, Discord, regular email`n" -ForegroundColor Red

Write-Host "3. Tell your friend to read: SETUP_GUIDE.md" -ForegroundColor White
Write-Host "   (They'll find everything they need there)`n" -ForegroundColor White

Write-Host "4. After sending credentials, DELETE the template file:" -ForegroundColor White
Write-Host "   Remove-Item CREDENTIALS_TEMPLATE_FOR_SHARING.md -Force`n" -ForegroundColor Yellow

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🎉 Ready to Share!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "For complete instructions, see: SHARING_SUMMARY.md`n" -ForegroundColor White
