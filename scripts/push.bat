@echo off
REM ═══════════════════════════════════════════════════════════════════════
REM PUSH.BAT — Pousse les modifications locales vers GitHub (Windows)
REM Usage: push.bat "Description du commit"
REM ═══════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

REM Aller à la racine du projet (parent du dossier scripts)
cd /d "%~dp0\.."

echo.
echo ===================================================
echo   PUSH vers GitHub
echo ===================================================
echo.

REM Vérifier qu'on est dans un repo Git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ❌ Pas un depot Git. Lance: git init ^&^& git remote add origin ^<url^>
    exit /b 1
)

REM Vérifier le remote
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ❌ Pas de remote 'origin'. Lance: git remote add origin ^<url^>
    exit /b 1
)

REM ─────────────────────────────────────────────────────────────────────
REM Vérifier les fichiers sensibles
REM ─────────────────────────────────────────────────────────────────────
echo 🔍 Vérification des fichiers sensibles...

for %%f in (".env" "db\custom.db" "prisma\db\custom.db") do (
    if exist "%%f" (
        git ls-files --error-unmatch "%%f" >nul 2>&1
        if not errorlevel 1 (
            echo ⚠️  ATTENTION: %%f est traqué dans Git !
            echo    Retrait du tracking ^(le fichier reste sur disque^)...
            git rm --cached "%%f" >nul 2>&1
        )
    )
)

REM Afficher le statut
echo.
echo 📋 État actuel:
git status --short
echo.

REM Récupérer le message de commit
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" (
    for /f "tokens=*" %%i in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "TIMESTAMP=%%i"
    set "COMMIT_MSG=Mise à jour !TIMESTAMP!"
)

REM Vérifier s'il y a quelque chose à committer
git diff --cached --quiet >nul 2>&1
set "STAGED=%errorlevel%"
git diff --quiet >nul 2>&1
set "UNSTAGED=%errorlevel%"
for /f %%i in ('git ls-files --others --exclude-standard') do set "UNTRACKED=1"

if "%STAGED%"=="0" if "%UNSTAGED%"=="0" if not defined UNTRACKED (
    echo ℹ️  Rien à committer. Vérification du push...
    goto :PULL_REBASE
)

REM Ajouter et committer
echo 📦 Ajout des fichiers...
git add -A

echo 📝 Commit: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo ❌ Échec du commit
    exit /b 1
)

:PULL_REBASE
REM Pull rebase avant push
echo.
echo 📥 Pull ^(rebase^) avant push...
git pull --rebase origin main
if errorlevel 1 (
    echo ❌ Conflit lors du pull rebase. Résous les conflits puis relance.
    echo    Pour abandonner: git rebase --abort
    exit /b 1
)

REM Push
echo.
echo 📤 Push vers origin/main...
git push origin main
if errorlevel 1 (
    echo.
    echo ❌ Échec du push. Vérifie tes droits d'accès GitHub.
    echo    Astuce: utilise un Personal Access Token ^(PAT^) comme mot de passe
    exit /b 1
)

echo.
echo ===================================================
echo   ✅ PUSH RÉUSSI !
echo ===================================================
echo.
echo Derniers commits:
git log --oneline -3
echo.
for /f %%i in ('git remote get-url origin') do echo URL: %%i

endlocal
