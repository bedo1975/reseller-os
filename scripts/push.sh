#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PUSH.SH — Pousse les modifications locales vers GitHub
# Usage: ./push.sh "Description du commit"
# ═══════════════════════════════════════════════════════════════════════
set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PUSH vers GitHub${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check if inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${RED}❌ Pas un dépôt Git. Lance: git init && git remote add origin <url>${NC}"
  exit 1
fi

# Check if remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
  echo -e "${RED}❌ Pas de remote 'origin'. Lance: git remote add origin <url>${NC}"
  exit 1
fi

# Check for sensitive files before committing
echo -e "${YELLOW}🔍 Vérification des fichiers sensibles...${NC}"
SENSITIVE_FILES=(
  ".env"
  "db/custom.db"
  "prisma/db/custom.db"
)

for file in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$file" ] && git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    echo -e "${RED}⚠️  ATTENTION: $file est traqué dans Git !${NC}"
    echo -e "${YELLOW}   Retrait du tracking (le fichier reste sur disque)...${NC}"
    git rm --cached "$file" 2>/dev/null || true
  fi
done

# Show what will be committed
echo ""
echo -e "${YELLOW}📋 État actuel:${NC}"
git status --short
echo ""

# Check if there's anything to commit
if git diff --cached --quiet && git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo -e "${YELLOW}ℹ️  Rien à committer. Vérification du push...${NC}"
else
  # Get commit message
  COMMIT_MSG="${1:-Mise à jour $(date +'%Y-%m-%d %H:%M')}"

  # Add all changes
  echo -e "${YELLOW}📦 Ajout des fichiers...${NC}"
  git add -A

  # Commit
  echo -e "${YELLOW}📝 Commit: ${COMMIT_MSG}${NC}"
  git commit -m "$COMMIT_MSG"
fi

# Pull first (to avoid push rejected)
echo ""
echo -e "${YELLOW}📥 Pull (rebase) avant push...${NC}"
if ! git pull --rebase origin main 2>&1; then
  echo -e "${RED}❌ Conflit lors du pull rebase. Résous les conflits puis relance.${NC}"
  echo -e "${YELLOW}   Pour abandonner: git rebase --abort${NC}"
  exit 1
fi

# Push
echo ""
echo -e "${YELLOW}📤 Push vers origin/main...${NC}"
if git push origin main 2>&1; then
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ PUSH RÉUSSI !${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}Dernier commit:${NC}"
  git log --oneline -3
  echo ""
  echo -e "${BLUE}URL: $(git remote get-url origin)${NC}"
else
  echo -e "${RED}❌ Échec du push. Vérifie tes droits d'accès GitHub.${NC}"
  exit 1
fi
