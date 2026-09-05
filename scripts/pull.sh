#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# PULL.SH — Déploie la dernière version de GitHub sur le serveur
# Usage: ./pull.sh
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
echo -e "${BLUE}  DÉPLOIEMENT depuis GitHub${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check if inside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo -e "${RED}❌ Pas un dépôt Git. Clone d'abord le repo:${NC}"
  echo -e "${YELLOW}   git clone https://github.com/bedo1975/reseller-os.git .${NC}"
  exit 1
fi

# Detect PM2 process name (try common names)
PM2_NAME=""
if command -v pm2 >/dev/null 2>&1; then
  for name in "junashop" "dboxpro" "reseller-os" "app" "all"; do
    if [ "$name" = "all" ]; then
      PM2_NAME="all"
    elif pm2 describe "$name" >/dev/null 2>&1; then
      PM2_NAME="$name"
      break
    fi
  done
fi

echo -e "${YELLOW}📋 État actuel:${NC}"
git log --oneline -3 2>/dev/null || echo "  (no commits yet)"
echo ""

# ─────────────────────────────────────────────────────────────────────
# 1. SAUVEGARDES (DB + .env)
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}💾 1/7 — Sauvegarde DB et .env...${NC}"
BACKUP_DIR="/tmp/junashop-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup DB (try multiple locations)
for db_path in "db/custom.db" "prisma/db/custom.db"; do
  if [ -f "$db_path" ]; then
    cp "$db_path" "$BACKUP_DIR/$(basename $db_path)"
    echo -e "  ✓ $db_path sauvegardée"
  fi
done

# Backup .env
if [ -f ".env" ]; then
  cp ".env" "$BACKUP_DIR/.env"
  echo -e "  ✓ .env sauvegardé"
fi

# Backup .user.ini (config panel)
if [ -f ".user.ini" ]; then
  cp ".user.ini" "$BACKUP_DIR/.user.ini"
  echo -e "  ✓ .user.ini sauvegardé"
fi

echo -e "  📁 Backup dans: $BACKUP_DIR"
echo ""

# ─────────────────────────────────────────────────────────────────────
# 2. STASH DES MODIFS LOCALES
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}📦 2/7 — Sauvegarde des modifs locales non commitées...${NC}"
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -u -m "auto-stash before pull $(date +%Y%m%d-%H%M%S)" 2>&1 || true
  STASHED=true
  echo -e "  ✓ Modifs locales stashées"
else
  echo -e "  ℹ️  Aucune modif locale"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────
# 3. PULL
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}📥 3/7 — Pull depuis GitHub...${NC}"
git fetch origin
git reset --hard origin/main

# Nettoie les fichiers untracked (vieux dossiers supprimés du repo mais encore présents sur le serveur)
# Important après une refonte de structure (ex: déplacement de /boutique/* vers /*)
# --force : ne demande pas confirmation
# -d : supprime aussi les dossiers vides
# On ne touche pas à .env, db/, node_modules/ car ils sont dans .gitignore
git clean -fd -- src/ public/
echo -e "  ✓ Code à jour + fichiers obsolètes supprimés"
echo ""

# Show new commits
echo -e "${BLUE}📋 Nouveaux commits:${NC}"
git log --oneline -5
echo ""

# ─────────────────────────────────────────────────────────────────────
# 4. RESTAURATION DB + .env
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}♻️  4/7 — Restauration DB et .env de production...${NC}"

# Restore DB
for db_path in "db/custom.db" "prisma/db/custom.db"; do
  backup_file="$BACKUP_DIR/$(basename $db_path)"
  if [ -f "$backup_file" ]; then
    mkdir -p "$(dirname $db_path)"
    cp "$backup_file" "$db_path"
    echo -e "  ✓ $db_path restaurée"
  fi
done

# Restore .env
if [ -f "$BACKUP_DIR/.env" ]; then
  cp "$BACKUP_DIR/.env" ".env"
  echo -e "  ✓ .env restauré"
fi

# Restore .user.ini
if [ -f "$BACKUP_DIR/.user.ini" ]; then
  cp "$BACKUP_DIR/.user.ini" ".user.ini"
  echo -e "  ✓ .user.ini restauré"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────
# 5. DÉPENDANCES + PRISMA
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}📦 5/7 — Installation dépendances + Prisma...${NC}"
npm install 2>&1 | tail -3
npx prisma generate 2>&1 | tail -3

# db push only if schema changed (avoid touching data unnecessarily)
npx prisma db push --accept-data-loss 2>&1 | tail -3
echo ""

# ─────────────────────────────────────────────────────────────────────
# 6. BUILD
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔨 6/7 — Build Next.js...${NC}"
rm -rf .next
if npm run build 2>&1 | tail -20; then
  echo -e "  ✓ Build OK"
else
  echo -e "${RED}  ❌ Build échoué ! Tentative avec webpack (bypass Turbopack)...${NC}"
  rm -rf .next
  if npx next build --webpack 2>&1 | tail -20; then
    echo -e "  ✓ Build OK avec webpack"
  else
    echo -e "${RED}  ❌ Build définitivement échoué. Restaure le précédent .next manuellement.${NC}"
    exit 1
  fi
fi
echo ""

# ─────────────────────────────────────────────────────────────────────
# 7. RESTART
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🔄 7/7 — Redémarrage du serveur...${NC}"
if [ -n "$PM2_NAME" ]; then
  pm2 restart "$PM2_NAME" --update-env 2>&1 | tail -5
  sleep 2
  echo -e "  ✓ PM2 process '$PM2_NAME' redémarré"
else
  echo -e "${YELLOW}  ⚠️  PM2 non trouvé ou process non détecté.${NC}"
  echo -e "${YELLOW}     Redémarre manuellement ton serveur (systemd, etc.)${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────
# 7b. PURGE NGINX CACHE (auto-purge after deploy)
# ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}🧹 7b/7 — Purge du cache nginx...${NC}"
# Méthode 1 : purge via endpoint /purge (si configuré dans nginx)
curl -s -o /dev/null -w "" -X PURGE "http://localhost/purge/" 2>/dev/null || true
# Méthode 2 : purge via curl sur /purge/* (variante)
curl -s -o /dev/null -w "" "http://localhost/purge/*" 2>/dev/null || true
# Méthode 3 : suppression directe du dossier cache (le plus fiable)
if [ -d "/var/cache/nginx" ]; then
  rm -rf /var/cache/nginx/* 2>/dev/null && echo -e "  ✓ Cache nginx vidé (/var/cache/nginx)" || echo -e "  ℹ️  Impossible de vider /var/cache/nginx (permissions?)"
fi
# Recharge nginx pour qu'il recrée les fichiers de cache
nginx -s reload 2>/dev/null && echo -e "  ✓ nginx rechargé" || true
echo ""

# Restore stash if any
if [ "$STASHED" = true ]; then
  echo -e "${YELLOW}♻️  Restauration du stash...${NC}"
  git stash pop 2>&1 || echo -e "  ℹ️  Conflit de stash — résous manuellement avec 'git stash list'"
fi

# Final check
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ DÉPLOIEMENT TERMINÉ !${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📊 Vérifications:${NC}"
echo -e "  - ${BLUE}Schema à jour:${NC} $(grep -c "hoursVisible" prisma/schema.prisma 2>/dev/null || echo 0) champs hoursVisible"
echo -e "  - ${BLUE}Route email test:${NC} $([ -f src/app/api/email-settings/test/route.ts ] && echo '✓ présente' || echo '❌ absente')"
echo -e "  - ${BLUE}PM2 status:${NC} $(pm2 jlist 2>/dev/null | grep -o '"status":"online"' | head -1 || echo 'N/A')"
echo ""
echo -e "${YELLOW}💾 Backup conservé dans: $BACKUP_DIR${NC}"
echo -e "${YELLOW}   (Supprime-le avec: rm -rf $BACKUP_DIR)${NC}"
