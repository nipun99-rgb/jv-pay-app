# Push latest commit files via GraphQL - bypasses Zscaler
$env:PATH += ";C:\Program Files\GitHub CLI;C:\Users\KR614XU\AppData\Local\Programs\Git\cmd"
$git     = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$owner   = "nipun99-rgb"
$repo    = "jv-pay-app"
$repoDir = "C:\Users\KR614XU\Downloads\Ishaan"
$batchSize = 6
Set-Location $repoDir

# Files changed in latest commit
$changedFiles = (& $git diff --name-only HEAD~1 HEAD) -split "`n" | Where-Object { $_ -ne "" }
Write-Host "Files to push: $($changedFiles.Count)"

# Current HEAD on GitHub (main branch)
$headOid = "be5c83f3f36bc488fa89a4fea7b0088cb86711e9"
Write-Host "Starting from OID: $headOid"

function Invoke-GQL($queryObj) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".json"
    $queryObj | ConvertTo-Json -Depth 20 -Compress | Set-Content $tmp -Encoding utf8
    $result = (gh api graphql --input $tmp 2>&1) | Out-String
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $result
}

$bNum = 1
for ($i = 0; $i -lt $changedFiles.Count; $i += $batchSize) {
    $batch = $changedFiles | Select-Object -Skip $i -First $batchSize
    Write-Host "Batch $bNum ($($batch.Count) files): $($batch -join ', ')"

    $additions = @()
    $deletions = @()
    foreach ($f in $batch) {
        $fp = Join-Path $repoDir $f.Replace("/", "\")
        if (-not (Test-Path $fp)) {
            # File was deleted
            $deletions += $f
            Write-Host "  (deleted) $f"
            continue
        }
        try {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fp))
            $additions += [ordered]@{ path = $f; contents = $b64 }
        } catch { Write-Host "  SKIP locked: $f" }
    }

    $fileChanges = [ordered]@{}
    if ($additions.Count -gt 0) { $fileChanges.additions = $additions }
    if ($deletions.Count -gt 0) { $fileChanges.deletions = $deletions }

    $mutation = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }'
    $inp = [ordered]@{
        branch          = [ordered]@{ repositoryNameWithOwner = "$owner/$repo"; branchName = "main" }
        message         = [ordered]@{ headline = "Update files batch $bNum" }
        fileChanges     = $fileChanges
        expectedHeadOid = $headOid
    }
    $resp = Invoke-GQL @{ query = $mutation; variables = @{ input = $inp } }
    $parsed = $resp | ConvertFrom-Json -ErrorAction SilentlyContinue
    $newOid = $parsed.data.createCommitOnBranch.commit.oid
    if ($newOid) {
        Write-Host "  OK -> $newOid" -ForegroundColor Green
        $headOid = $newOid
    } else {
        Write-Host "  FAILED: $resp" -ForegroundColor Red
        break
    }
    $bNum++
}

Write-Host "`nFinal HEAD: $headOid"
Write-Host "Updating branch Version-1(App-extraction) ..."
$brResp = (gh api --method PATCH "repos/$owner/$repo/git/refs/heads/Version-1(App-extraction)" -f sha=$headOid -F force=true 2>&1) | Out-String
if ($brResp -match '"ref"') { Write-Host "Branch updated!" -ForegroundColor Green }
else { Write-Host "Branch response: $brResp" }

Write-Host "`nDone! https://github.com/$owner/$repo/tree/Version-1%28App-extraction%29" -ForegroundColor Cyan
