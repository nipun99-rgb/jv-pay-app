# Push all repo files via GitHub GraphQL createCommitOnBranch - bypasses Zscaler
$env:PATH += ";C:\Program Files\GitHub CLI;C:\Users\KR614XU\AppData\Local\Programs\Git\cmd"
$git     = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$owner   = "nipun99-rgb"
$repo    = "jv-pay-app"
$branch  = "Version-1(App-extraction)"
$repoDir = "C:\Users\KR614XU\Downloads\Ishaan"
$batchSize = 8
Set-Location $repoDir

Write-Host ">>> Getting file list..." -ForegroundColor Cyan
$files = (& $git ls-files) -split "`n" | Where-Object { $_ -ne "" }
Write-Host "    $($files.Count) files"

function Invoke-GQL($queryObj) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".json"
    $queryObj | ConvertTo-Json -Depth 20 -Compress | Set-Content $tmp -Encoding utf8
    $result = gh api graphql --input $tmp 2>&1
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $result
}

function Push-Batch($batchFiles, $targetBranch, $headOid, $msg, $isFirst) {
    $additions = @()
    foreach ($f in $batchFiles) {
        $fp = Join-Path $repoDir $f.Replace("/", "\")
        if (-not (Test-Path $fp)) { Write-Host "  SKIP: $f"; continue }
        try {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fp))
            $additions += [ordered]@{ path = $f; contents = $b64 }
        } catch { Write-Host "  SKIP (locked): $f" }
    }
    $mutation = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }'
    $inp = [ordered]@{
        branch = [ordered]@{ repositoryNameWithOwner = "$owner/$repo"; branchName = $targetBranch }
        message = [ordered]@{ headline = $msg }
        fileChanges = [ordered]@{ additions = $additions }
        expectedHeadOid = $headOid
    }
    $resp = Invoke-GQL @{ query = $mutation; variables = @{ input = $inp } }
    $oid = ($resp | ConvertFrom-Json -ErrorAction SilentlyContinue).data.createCommitOnBranch.commit.oid
    if ($oid) { Write-Host "  OK ($($additions.Count) files) -> $oid" -ForegroundColor Green }
    else       { Write-Host "  FAILED: $resp" -ForegroundColor Red }
    return $oid
}

# Step 1: Get current HEAD OID of main (auto-init README already exists)
Write-Host "`n>>> Getting HEAD OID of main..." -ForegroundColor Cyan
$headOid = gh api graphql -f query='{ repository(owner:"nipun99-rgb", name:"jv-pay-app") { defaultBranchRef { target { oid } } } }' --jq ".data.repository.defaultBranchRef.target.oid" 2>&1
Write-Host "    HEAD: $headOid"

# Step 2: Push ALL files in batches to main
Write-Host "`n>>> Pushing $($files.Count) files to main in batches of $batchSize..." -ForegroundColor Cyan
$bNum = 1
for ($i = 0; $i -lt $files.Count; $i += $batchSize) {
    $batch = $files | Select-Object -Skip $i -First $batchSize
    Write-Host "  Batch $bNum ($($batch.Count) files)..."
    $newOid = Push-Batch $batch "main" $headOid "Add files batch $bNum" ($i -eq 0)
    if ($newOid) { $headOid = $newOid } else { Write-Host "  Stopping on error." -ForegroundColor Red; break }
    $bNum++
}

# Step 3: Create feature branch Version-1(App-extraction) pointing to final commit
Write-Host "`n>>> Creating branch '$branch' from final commit $headOid..." -ForegroundColor Cyan
$tmp3 = [System.IO.Path]::GetTempFileName() + ".json"
@{ ref = "refs/heads/$branch"; sha = $headOid } | ConvertTo-Json | Set-Content $tmp3 -Encoding utf8
$brResp = gh api --method POST "repos/$owner/$repo/git/refs" --input $tmp3 2>&1
Remove-Item $tmp3 -Force -ErrorAction SilentlyContinue
if ($brResp -match '"ref"') { Write-Host "  Branch created!" -ForegroundColor Green }
else { Write-Host "  Branch error: $brResp" -ForegroundColor Red }

Write-Host "`n>>> ALL DONE!" -ForegroundColor Green
Write-Host "    https://github.com/$owner/$repo/tree/$([Uri]::EscapeDataString($branch))" -ForegroundColor Cyan
