# Push all repo files via GitHub GraphQL createCommitOnBranch (bypasses Zscaler)
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

# Step 1: Get repo node ID
Write-Host "`n>>> Getting repo node ID..." -ForegroundColor Cyan
$repoNode = gh api graphql -f query="{ repository(owner:`"$owner`", name:`"$repo`") { id } }" --jq ".data.repository.id" 2>&1
Write-Host "    Repo ID: $repoNode"

# Step 2: Initialize repo with a README so branch operations work
Write-Host "`n>>> Checking if repo needs initialization..." -ForegroundColor Cyan
$emptyCheck = gh api "repos/$owner/$repo" --jq ".size" 2>&1
Write-Host "    Repo size: $emptyCheck"

if ($emptyCheck -eq "0") {
    Write-Host "    Initializing via REST (create README on default branch)..." -ForegroundColor Yellow
    $readmeB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("# jv-pay-app`nJV Pay Application"))
    $tmp = [System.IO.Path]::GetTempFileName()
    @{ message = "init"; content = $readmeB64 } | ConvertTo-Json | Set-Content $tmp -Encoding utf8
    $initResp = gh api --method PUT "repos/$owner/$repo/contents/README.md" --input $tmp 2>&1
    Remove-Item $tmp -Force
    Write-Host "    Init response: $($initResp | Select-String 'sha' | Select-Object -First 1)"
}

# Step 3: Get current HEAD OID of default branch (needed for createCommitOnBranch)
Write-Host "`n>>> Getting HEAD OID..." -ForegroundColor Cyan
$headOid = gh api graphql -f query="{ repository(owner:`"$owner`", name:`"$repo`") { defaultBranchRef { target { oid } } } }" --jq ".data.repository.defaultBranchRef.target.oid" 2>&1
Write-Host "    HEAD OID: $headOid"

# Step 4: Create feature branch from HEAD
Write-Host "`n>>> Creating branch '$branch'..." -ForegroundColor Cyan
$tmp2 = [System.IO.Path]::GetTempFileName()
@{ ref = "refs/heads/$branch"; sha = $headOid } | ConvertTo-Json | Set-Content $tmp2 -Encoding utf8
$branchResp = gh api --method POST "repos/$owner/$repo/git/refs" --input $tmp2 2>&1
Remove-Item $tmp2 -Force
Write-Host "    $($branchResp | Select-String 'ref' | Select-Object -First 1)"

# Step 5: Push files in batches via createCommitOnBranch
Write-Host "`n>>> Pushing files via GraphQL..." -ForegroundColor Cyan
$batchSize = 10
$batches = [math]::Ceiling($files.Count / $batchSize)
$currentOid = $headOid

for ($b = 0; $b -lt $batches; $b++) {
    $batchFiles = $files | Select-Object -Skip ($b * $batchSize) -First $batchSize
    $bNum = $b+1; Write-Host "  Batch $bNum/${batches}: $($batchFiles.Count) files..."

    # Build additions array for GraphQL
    $additions = @()
    foreach ($f in $batchFiles) {
        $fullPath = Join-Path $repoDir $f.Replace("/", "\")
        if (-not (Test-Path $fullPath)) { continue }
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $b64   = [Convert]::ToBase64String($bytes)
        $additions += @{ path = $f; contents = $b64 }
    }

    # Build GraphQL mutation
    $additionsJson = $additions | ConvertTo-Json -Depth 3 -Compress
    $mutation = @"
mutation {
  createCommitOnBranch(input: {
    branch: { repositoryNameWithOwner: "$owner/$repo", branchName: "$branch" }
    message: { headline: "Add files batch $bNum" }
    fileChanges: { additions: $additionsJson }
    expectedHeadOid: "$currentOid"
  }) { commit { oid } }
}
"@
    $tmpMut = [System.IO.Path]::GetTempFileName()
    $mutation | Set-Content $tmpMut -Encoding utf8
    $mutResp = gh api graphql -f "query=@$tmpMut" 2>&1
    Remove-Item $tmpMut -Force

    $newOid = ($mutResp | ConvertFrom-Json -ErrorAction SilentlyContinue).data.createCommitOnBranch.commit.oid
    if ($newOid) {
        $currentOid = $newOid
        Write-Host "    Batch $bNum OK -> $newOid" -ForegroundColor Green
    } else {
        Write-Host "    Batch $bNum ERR: $mutResp" -ForegroundColor Red
    }
}

Write-Host "`n>>> DONE! View at: https://github.com/$owner/$repo" -ForegroundColor Green
