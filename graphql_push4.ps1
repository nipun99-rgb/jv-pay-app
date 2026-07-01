# Resume push from batch 2 - first 8 files already pushed
$env:PATH += ";C:\Program Files\GitHub CLI;C:\Users\KR614XU\AppData\Local\Programs\Git\cmd"
$git     = "C:\Users\KR614XU\AppData\Local\Programs\Git\cmd\git.exe"
$owner   = "nipun99-rgb"
$repo    = "jv-pay-app"
$repoDir = "C:\Users\KR614XU\Downloads\Ishaan"
$batchSize = 8
Set-Location $repoDir

$allFiles = (& $git ls-files) -split "`n" | Where-Object { $_ -ne "" }
$remainingFiles = $allFiles | Select-Object -Skip 8
Write-Host "Files remaining to push: $($remainingFiles.Count)"

# Current HEAD after batch 1
$headOid = "71df44c6e1524add66a91f41263427b42539edd2"

function Invoke-GQL($queryObj) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".json"
    $queryObj | ConvertTo-Json -Depth 20 -Compress | Set-Content $tmp -Encoding utf8
    $result = (gh api graphql --input $tmp 2>&1) | Out-String
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $result
}

$bNum = 2
for ($i = 0; $i -lt $remainingFiles.Count; $i += $batchSize) {
    $batch = $remainingFiles | Select-Object -Skip $i -First $batchSize
    Write-Host "Batch $bNum ($($batch.Count) files): $($batch -join ', ')"

    $additions = @()
    foreach ($f in $batch) {
        $fp = Join-Path $repoDir $f.Replace("/", "\")
        if (-not (Test-Path $fp)) { Write-Host "  SKIP missing: $f"; continue }
        try {
            $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fp))
            $additions += [ordered]@{ path = $f; contents = $b64 }
        } catch { Write-Host "  SKIP locked: $f" }
    }

    if ($additions.Count -eq 0) { Write-Host "  No additions, skipping"; $bNum++; continue }

    $mutation = 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }'
    $inp = [ordered]@{
        branch       = [ordered]@{ repositoryNameWithOwner = "$owner/$repo"; branchName = "main" }
        message      = [ordered]@{ headline = "Add files batch $bNum" }
        fileChanges  = [ordered]@{ additions = $additions }
        expectedHeadOid = $headOid
    }
    $resp = Invoke-GQL @{ query = $mutation; variables = @{ input = $inp } }

    $parsed = $resp | ConvertFrom-Json -ErrorAction SilentlyContinue
    $newOid  = $parsed.data.createCommitOnBranch.commit.oid
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
Write-Host "Updating branch Version-1(App-extraction) to $headOid ..."
$brResp = (gh api --method PATCH "repos/$owner/$repo/git/refs/heads/Version-1(App-extraction)" -f sha=$headOid -F force=true 2>&1) | Out-String
if ($brResp -match '"ref"') { Write-Host "Branch updated!" -ForegroundColor Green }
else { Write-Host "Branch response: $brResp" }

Write-Host "`nDone! https://github.com/$owner/$repo/tree/Version-1%28App-extraction%29" -ForegroundColor Cyan
