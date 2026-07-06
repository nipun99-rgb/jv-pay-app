# Push latest commit to UI-plan-July-pre(langraph)-v2 branch via GitHub GraphQL
$env:PATH += ";C:\Program Files\GitHub CLI;C:\Users\KR614XU\AppData\Local\Programs\Git\cmd"
$git          = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$owner        = "nipun99-rgb"
$repo         = "jv-pay-app"
$repoDir      = "C:\Users\KR614XU\Downloads\Ishaan"
$targetBranch = "UI-plan-July-pre(langraph)-v2"
$batchSize    = 5
Set-Location $repoDir

# Parse additions and deletions from git diff
$allChanged = (& $git diff --name-status HEAD~1 HEAD) -split "`n" | Where-Object { $_ -ne "" }
$addFiles = @(); $delFiles = @()
foreach ($line in $allChanged) {
    if ($line -match "^[AM]\t(.+)$") { $addFiles += $Matches[1] }
    elseif ($line -match "^D\t(.+)$") { $delFiles += $Matches[1] }
}
Write-Host "Additions/modifications: $($addFiles.Count)"
Write-Host "Deletions: $($delFiles.Count)"

# Starting OID = current HEAD of the new branch (same as main)
$headOid = "a687c8d8fd82b64ac8fb1e0f6aac67b4ccb6935b"
Write-Host "Starting OID: $headOid"

function Invoke-GQL($queryObj) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".json"
    $queryObj | ConvertTo-Json -Depth 20 -Compress | Set-Content $tmp -Encoding utf8
    $result = (gh api graphql --input $tmp 2>&1) | Out-String
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $result
}

function Push-Commit($addBatch, $delBatch, $msg) {
    $additions = @()
    foreach ($f in $addBatch) {
        $fp = Join-Path $repoDir $f.Replace("/", "\")
        if (-not (Test-Path $fp)) { Write-Host "  SKIP missing: $f"; continue }
        try {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fp))
            $additions += [ordered]@{ path = $f; contents = $b64 }
        } catch { Write-Host "  SKIP locked: $f" }
    }
    $deletions = $delBatch | ForEach-Object { [ordered]@{ path = $_ } }

    $fileChanges = [ordered]@{}
    if ($additions.Count -gt 0) { $fileChanges.additions = $additions }
    if ($deletions.Count -gt 0) { $fileChanges.deletions = $deletions }
    if ($fileChanges.Count -eq 0) { return $script:headOid }

    $mutation = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }'
    $inp = [ordered]@{
        branch          = [ordered]@{ repositoryNameWithOwner = "$owner/$repo"; branchName = $targetBranch }
        message         = [ordered]@{ headline = $msg }
        fileChanges     = $fileChanges
        expectedHeadOid = $script:headOid
    }
    $resp = Invoke-GQL @{ query = $mutation; variables = @{ input = $inp } }
    $newOid = ($resp | ConvertFrom-Json -ErrorAction SilentlyContinue).data.createCommitOnBranch.commit.oid
    if ($newOid) { Write-Host "  OK -> $newOid" -ForegroundColor Green; return $newOid }
    else { Write-Host "  FAILED: $resp" -ForegroundColor Red; return $null }
}

# Push additions in batches
$bNum = 1
Write-Host "`n>>> Pushing $($addFiles.Count) additions..."
for ($i = 0; $i -lt $addFiles.Count; $i += $batchSize) {
    $batch = $addFiles | Select-Object -Skip $i -First $batchSize
    Write-Host "Batch $bNum ($($batch.Count) files): $($batch -join ', ')"
    $newOid = Push-Commit $batch @() "Add files batch $bNum"
    if ($newOid) { $script:headOid = $newOid } else { Write-Host "Stopping." -ForegroundColor Red; exit 1 }
    $bNum++
}

# Push deletions in chunks of 20
if ($delFiles.Count -gt 0) {
    Write-Host "`n>>> Pushing $($delFiles.Count) deletions..."
    for ($i = 0; $i -lt $delFiles.Count; $i += 20) {
        $chunk = $delFiles | Select-Object -Skip $i -First 20
        Write-Host "Deletion batch ($($chunk.Count) files)..."
        $newOid = Push-Commit @() $chunk "Remove legacy files batch $bNum"
        if ($newOid) { $script:headOid = $newOid } else { Write-Host "Stopping." -ForegroundColor Red; exit 1 }
        $bNum++
    }
}

Write-Host "`nFinal HEAD: $($script:headOid)"
Write-Host "Done! https://github.com/$owner/$repo/tree/UI-plan-July-pre(langraph)-v2" -ForegroundColor Cyan
