# ============================================================
#  Run this script ONCE to create the GitHub repo and push.
#  It will open your browser to authenticate with GitHub.
# ============================================================

$git = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$gh  = "C:\Program Files\GitHub CLI\gh.exe"

# Step 1: Authenticate with GitHub (opens browser)
Write-Host ">>> Authenticating with GitHub..." -ForegroundColor Cyan
& $gh auth login --web --hostname github.com --git-protocol https

# Step 2: Create public repo named jv-pay-app
Write-Host ">>> Creating GitHub repository jv-pay-app..." -ForegroundColor Cyan
& $gh repo create jv-pay-app --public --description "JV Pay Application - PDF extraction pipeline and project manager"

# Step 3: Add remote and push
Write-Host ">>> Pushing branch Version-1(App-extraction) to GitHub..." -ForegroundColor Cyan
$ghUser = & $gh api user --jq ".login" 2>&1
& $git remote add origin "https://github.com/$ghUser/jv-pay-app.git"
& $git push -u origin "Version-1(App-extraction)"

Write-Host ""
Write-Host ">>> Done! Your code is live at: https://github.com/$ghUser/jv-pay-app" -ForegroundColor Green
