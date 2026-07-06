# Workspace Structure Verification Script
# Purpose: Verify V2 application structure is correct and stale folders are properly archived
# Last Updated: 2026-07-06

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  V2 Workspace Structure Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$errors = @()
$warnings = @()
$success = @()

# Function to test path and report
function Test-Structure {
    param(
        [string]$Path,
        [string]$Description,
        [string]$Type = "Required"
    )
    
    if (Test-Path $Path) {
        $success += "✅ $Description"
        return $true
    } else {
        if ($Type -eq "Required") {
            $errors += "❌ MISSING: $Description - $Path"
        } else {
            $warnings += "⚠️  Optional: $Description - $Path"
        }
        return $false
    }
}

Write-Host "Checking V2 Active Folders..." -ForegroundColor Yellow

# V2 Active Structure
Test-Structure "frontend" "Frontend React App"
Test-Structure "frontend/src/App.tsx" "Frontend entry point"
Test-Structure "frontend/package.json" "Frontend dependencies"

Test-Structure "api-gateway" "API Gateway"
Test-Structure "api-gateway/src/index.ts" "API Gateway entry point"
Test-Structure "api-gateway/prisma/schema.prisma" "Prisma schema"

Test-Structure "ai-engine" "AI Engine"
Test-Structure "ai-engine/app/main.py" "AI Engine entry point"
Test-Structure "ai-engine/app/graph" "LangGraph agents folder"

Test-Structure "docker-compose.yml" "Docker Compose orchestration"

Write-Host "`nChecking Documentation..." -ForegroundColor Yellow

# Documentation
Test-Structure ".ai-context.md" "AI Agent context file"
Test-Structure "PROJECT_STRUCTURE.md" "Project structure documentation"
Test-Structure ".aidigest" "AI digest quick reference"
Test-Structure "README.md" "Main README"
Test-Structure "CONTRIBUTING.md" "Contributing guidelines"
Test-Structure "V2-QUICK-START.md" "Quick start guide"

Test-Structure "Docs/version-2-documentation" "V2 Documentation folder"
Test-Structure "Docs/version-2-documentation/09-langgraph-architecture-diagrams.html" "Architecture diagrams (20 sections)"

Write-Host "`nChecking Archived/Stale Folders..." -ForegroundColor Yellow

# Archived folders (should exist but not be used)
if (Test-Path "_archive") {
    $success += "✅ Archive folder exists (_archive/)"
    
    if (Test-Path "_archive/project-manager-v1") {
        $success += "✅ V1 backend properly archived"
    }
    
    if (Test-Path "_archive/extraction-script-legacy") {
        $success += "✅ Legacy scripts properly archived"
    }
} else {
    $warnings += "⚠️  No _archive folder (V1 code may not be archived)"
}

# Stale project-manager folder check
if (Test-Path "project-manager") {
    $warnings += "⚠️  STALE FOLDER DETECTED: project-manager/ should be removed or archived"
    $warnings += "   → This folder is from V1 and should not be used"
    $warnings += "   → Try closing any terminals in that directory and run: Remove-Item project-manager -Recurse -Force"
}

Write-Host "`nChecking .gitignore..." -ForegroundColor Yellow

if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    
    if ($gitignoreContent -match "_archive/") {
        $success += "✅ .gitignore properly ignores _archive/"
    } else {
        $warnings += "⚠️  .gitignore doesn't ignore _archive/"
    }
    
    if ($gitignoreContent -match "project-manager/") {
        $success += "✅ .gitignore properly ignores project-manager/"
    } else {
        $warnings += "⚠️  .gitignore doesn't ignore project-manager/"
    }
}

# Display Results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Verification Results" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "SUCCESS ($($success.Count)):" -ForegroundColor Green
$success | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }

if ($warnings.Count -gt 0) {
    Write-Host "`nWARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
}

if ($errors.Count -gt 0) {
    Write-Host "`nERRORS ($($errors.Count)):" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "`n❌ VERIFICATION FAILED - Please fix errors above`n" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n✅ VERIFICATION PASSED - V2 structure is correct!`n" -ForegroundColor Green
    
    if ($warnings.Count -gt 0) {
        Write-Host "Note: There are $($warnings.Count) warnings above. Review them if needed.`n" -ForegroundColor Yellow
    }
}

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Read .ai-context.md for AI agent instructions" -ForegroundColor White
Write-Host "  2. Read PROJECT_STRUCTURE.md for complete folder breakdown" -ForegroundColor White
Write-Host "  3. Start the app: docker-compose up" -ForegroundColor White
Write-Host "  4. Or see V2-QUICK-START.md for development mode`n" -ForegroundColor White
