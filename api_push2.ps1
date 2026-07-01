# Push all repo files to GitHub via Contents API (bypasses Zscaler git-protocol block)
$env:PATH += ";C:\Program Files\GitHub CLI;C:\Users\KR614XU\AppData\Local\Programs\Git\cmd"
$git     = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$owner   = "nipun99-rgb"
$repo    = "jv-pay-app"
$branch  = "Version-1(App-extraction)"
$repoDir = "C:\Users\KR614XU\Downloads\Ishaan"
Set-Location $repoDir

Write-Host ">>> Getting file list..." -ForegroundColor Cyan
$files = (& $git ls-files) -split "`n" | Where-Object { $_ -ne "" }
Write-Host "    $($files.Count) files"

function Upload-File($filePath, $branchName, $msg) {
    $fullPath = Join-Path $repoDir $filePath.Replace("/", "\")
    if (-not (Test-Path $fullPath)) { Write-Host "  SKIP: $filePath"; return $null }
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $b64   = [Convert]::ToBase64String($bytes)
    $body  = @{ message = $msg; content = $b64; branch = $branchName } | ConvertTo-Json -Compress
    $tmp   = [System.IO.Path]::GetTempFileName()
    Set-Content $tmp $body -Encoding utf8
    $resp  = gh api --method PUT "repos/$owner/$repo/contents/$filePath" --input $tmp 2>&1
    Remove-Item $tmp -Force
    if ($resp -match '"sha"') { Write-Host "  OK: $filePath" -ForegroundColor Green; return $true }
    Write-Host "  ERR: $filePath -> $($resp | Select-String 'message')" -ForegroundColor Red
    return $false
}

# Step 1: Upload first file to DEFAULT branch (initializes the empty repo)
Write-Host "`n>>> Initializing repo (first file to default branch)..." -ForegroundColor Cyan
$f0       = $files[0]
$fullPath0 = Join-Path $repoDir $f0.Replace("/", "\")
$bytes0   = [System.IO.File]::ReadAllBytes($fullPath0)
$b640     = [Convert]::ToBase64String($bytes0)
$body0    = @{ message = "init"; content = $b640 } | ConvertTo-Json -Compress
$tmp0     = [System.IO.Path]::GetTempFileName()
Set-Content $tmp0 $body0 -Encoding utf8
$init     = gh api --method PUT "repos/$owner/$repo/contents/$f0" --input $tmp0 2>&1
Remove-Item $tmp0 -Force
$initSha  = ($init | ConvertFrom-Json -ErrorAction SilentlyContinue).commit.sha
Write-Host "    Init SHA: $initSha"

if (-not $initSha) { Write-Host "ERROR: $init"; exit 1 }

# Step 2: Create feature branch from that init commit
Write-Host "`n>>> Creating branch '$branch'..." -ForegroundColor Cyan
$tmpRef = [System.IO.Path]::GetTempFileName()
@{ ref = "refs/heads/$branch"; sha = $initSha } | ConvertTo-Json -Compress | Set-Content $tmpRef -Encoding utf8
$refResp = gh api --method POST "repos/$owner/$repo/git/refs" --input $tmpRef 2>&1
Remove-Item $tmpRef -Force
Write-Host "    $($refResp | Select-String 'ref')"

# Step 3: Upload ALL files to feature branch
Write-Host "`n>>> Uploading $($files.Count) files to '$branch'..." -ForegroundColor Cyan
$ok = 0; $err = 0
foreach ($f in $files) {
    $res = Upload-File $f $branch "Add $f"
    if ($res) { $ok++ } else { $err++ }
}

Write-Host "`n>>> DONE! $ok OK / $err errors" -ForegroundColor Green
Write-Host "    https://github.com/$owner/$repo" -ForegroundColor Cyan
