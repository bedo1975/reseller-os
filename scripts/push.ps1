# ═══════════════════════════════════════════════════════════════════════
# PUSH.PS1 — Pousse les modifications locales vers GitHub (Windows PowerShell)
# Usage: .\push.ps1 "Description du commit"
# ═══════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Colors
$Colors = @{
    Green = "Green"
    Red   = "Red"
    Yellow = "Yellow"
    Blue  = "Cyan"
}

Write-Host "═══════════════════════════════════════════════" -ForegroundColor $Colors.Blue
Write-Host "  PUSH vers GitHub" -ForegroundColor $Colors.Blue
Write-Host "═══════════════════════════════════════════════" -ForegroundColor $Colors.Blue
Write-Host ""

# Check if inside a git repo
try {
    git rev-parse --is-inside-work-tree *>$null
    if ($LASTEXITCODE -ne 0) { throw "not a repo" }
} catch {
    Write-Host "❌ Pas un dépôt Git. Lance: git init && git remote add origin <url>" -ForegroundColor $Colors.Red
    exit 1
}

# Check if remote exists
try {
    git remote get-url origin *>$null
    if ($LASTEXITCODE -ne 0) { throw "no remote" }
} catch {
    Write-Host "❌ Pas de remote 'origin'. Lance: git remote add origin <url>" -ForegroundColor $Colors.Red
    exit 1
}

# ─────────────────────────────────────────────────────────────────────
# Check for sensitive files being tracked
# ─────────────────────────────────────────────────────────────────────
Write-Host "🔍 Vérification des fichiers sensibles..." -ForegroundColor $Colors.Yellow
$sensitiveFiles = @(".env", "db/custom.db", "prisma/db/custom.db")
foreach ($file in $sensitiveFiles) {
    if (Test-Path $file) {
        $tracked = git ls-files --error-unmatch $file 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "⚠️  ATTENTION: $file est traqué dans Git !" -ForegroundColor $Colors.Red
            Write-Host "   Retrait du tracking (le fichier reste sur disque)..." -ForegroundColor $Colors.Yellow
            git rm --cached $file 2>$null | Out-Null
        }
    }
}

# Show status
Write-Host ""
Write-Host "📋 État actuel:" -ForegroundColor $Colors.Yellow
git status --short
Write-Host ""

# Check if there's anything to commit
$staged = git diff --cached --name-only 2>$null
$unstaged = git diff --name-only 2>$null
$untracked = git ls-files --others --exclude-standard 2>$null

if (-not $staged -and -not $unstaged -and -not $untracked) {
    Write-Host "ℹ️  Rien à committer. Vérification du push..." -ForegroundColor $Colors.Yellow
} else {
    # Get commit message
    $commitMsg = if ($args.Count -gt 0) { $args[0] } else { "Mise à jour $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

    # Add all changes
    Write-Host "📦 Ajout des fichiers..." -ForegroundColor $Colors.Yellow
    git add -A

    # Commit
    Write-Host "📝 Commit: $commitMsg" -ForegroundColor $Colors.Yellow
    git commit -m $commitMsg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec du commit" -ForegroundColor $Colors.Red
        exit 1
    }
}

# Pull first (rebase) to avoid push rejected
Write-Host ""
Write-Host "📥 Pull (rebase) avant push..." -ForegroundColor $Colors.Yellow
git pull --rebase origin main 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Conflit lors du pull rebase. Résous les conflits puis relance." -ForegroundColor $Colors.Red
    Write-Host "   Pour abandonner: git rebase --abort" -ForegroundColor $Colors.Yellow
    exit 1
}

# Push
Write-Host ""
Write-Host "📤 Push vers origin/main..." -ForegroundColor $Colors.Yellow
$pushOutput = git push origin main 2>&1
$pushOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor $Colors.Green
    Write-Host "  ✅ PUSH RÉUSSI !" -ForegroundColor $Colors.Green
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor $Colors.Green
    Write-Host ""
    Write-Host "Derniers commits:" -ForegroundColor $Colors.Blue
    git log --oneline -3
    Write-Host ""
    $remoteUrl = git remote get-url origin
    Write-Host "URL: $remoteUrl" -ForegroundColor $Colors.Blue
} else {
    Write-Host "❌ Échec du push. Vérifie tes droits d'accès GitHub." -ForegroundColor $Colors.Red
    Write-Host "   Astuce: utilise un Personal Access Token (PAT) comme mot de passe" -ForegroundColor $Colors.Yellow
    exit 1
}
