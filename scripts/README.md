# 🚀 Scripts de déploiement

Deux scripts pour gérer proprement le cycle **local → GitHub → serveur**.

## 📤 `push.sh` — Sur ton PC local

Pousse tes modifications vers GitHub en toute sécurité.

### Usage

```bash
# Commit + push avec message auto
./push.sh

# Commit + push avec message personnalisé
./push.sh "Ajout page contact"
```

### Ce qu'il fait

1. ✅ Vérifie qu'aucun fichier sensible (`.env`, `db/custom.db`) n'est traqué
2. ✅ Si un fichier sensible est traqué, le retire automatiquement (`git rm --cached`)
3. ✅ Affiche l'état des fichiers (`git status --short`)
4. ✅ Ajoute tous les fichiers (`git add -A`)
5. ✅ Commit avec ton message (ou un message auto-daté)
6. ✅ Pull rebase avant push (évite les "push rejected")
7. ✅ Push vers `origin/main`
8. ✅ Affiche l'URL GitHub et les derniers commits

### Installation (Windows)

```powershell
# Rendre exécutable (Git Bash)
chmod +x push.sh

# Ou utilise Git Bash directement
bash push.sh "Mon commit"
```

---

## 📥 `pull.sh` — Sur ton serveur dédié

Déploie la dernière version de GitHub proprement, sans perdre tes données de production.

### Usage

```bash
cd /www/wwwroot/junashop.fr
./pull.sh
```

### Ce qu'il fait (7 étapes)

1. **💾 Sauvegarde** DB (`db/custom.db`, `prisma/db/custom.db`), `.env`, `.user.ini` dans `/tmp/junashop-backup-YYYYMMDD-HHMMSS/`
2. **📦 Stash** les modifs locales non commitées (au cas où)
3. **📥 Pull** propre : `git fetch origin && git reset --hard origin/main` (force l'adoption du code GitHub)
4. **♻️ Restaure** la DB de production, le `.env`, le `.user.ini` depuis la sauvegarde
5. **📦 Installe** les dépendances (`npm install --omit=dev`) + régénère Prisma (`prisma generate` + `prisma db push`)
6. **🔨 Build** Next.js (`rm -rf .next && npm run build`)
7. **🔄 Redémarre** PM2 (détecte automatiquement le process : `junashop`, `dboxpro`, `reseller-os`, ou `all`)

À la fin, il affiche :
- Le nombre de champs `hoursVisible` dans le schéma (vérif que le code est à jour)
- Si la route `email-settings/test` est présente
- Le statut PM2
- Le chemin du backup (à supprimer manuellement après vérification)

### Installation (Linux)

```bash
cd /www/wwwroot/junashop.fr
chmod +x pull.sh
./pull.sh
```

---

## 🔄 Workflow complet

### Sur ton PC (local)

1. Modifie le code
2. Teste avec `npm run dev`
3. Pousse :
   ```bash
   ./push.sh "Ajout fonctionnalité X"
   ```

### Sur ton serveur

1. Connecte-toi en SSH
2. Déploie :
   ```bash
   cd /www/wwwroot/junashop.fr
   ./pull.sh
   ```
3. Vérifie que ça marche
4. Si tout est OK, supprime le backup :
   ```bash
   rm -rf /tmp/junashop-backup-*
   ```

### En cas de problème

Le script `pull.sh` garde toujours un backup dans `/tmp/junashop-backup-YYYYMMDD-HHMMSS/`. Pour restaurer :

```bash
# Lister les backups
ls -la /tmp/junashop-backup-*

# Restaurer la DB
cp /tmp/junashop-backup-XXX/custom.db db/custom.db
cp /tmp/junashop-backup-XXX/custom.db prisma/db/custom.db

# Restaurer le .env
cp /tmp/junashop-backup-XXX/.env .env

# Redémarrer
pm2 restart junashop
```

---

## ⚠️ Règles d'or

1. **Ne jamais committer** : `.env`, `db/custom.db`, `node_modules/`, `.next/`
2. **Toujours tester en local** avant de push
3. **Le `pull.sh` sauvegarde toujours** avant de toucher au code
4. **Vérifie les logs PM2** si quelque chose ne marche pas :
   ```bash
   pm2 logs junashop --lines 50
   ```

## 🛠️ Personnalisation

Si le nom de ton process PM2 est différent, modifie la liste dans `pull.sh` :

```bash
for name in "junashop" "dboxpro" "reseller-os" "app" "ton-nom"; do
```
