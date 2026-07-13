# Reseller OS — Gestion multi-plateformes pour revendeurs pro

Application Next.js 16 qui centralise toute votre activité de revente :
**Vinted · Leboncoin · eBay · Vestiaire Collective · Stock physique · Comptabilité · Fournisseurs · Colis · Rentabilité**

Multi-utilisateurs · PWA mobile · QR codes · IA intégrée · Conformité URSSAF

---

## 📦 Stack technique

- **Next.js 16** (App Router, Turbopack) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (style New York)
- **Prisma ORM** + **SQLite** (base locale, zéro config, fichier unique)
- **NextAuth.js v4** (authentification multi-utilisateurs, sessions JWT, bcrypt)
- **Recharts** (graphiques) · **Zustand** (state client) · **Lucide** (icônes) · **Sonner** (toasts)
- **html5-qrcode** (scan caméra mobile) · **qrcode** (génération QR codes)
- **10 providers IA** : Groq, OpenRouter, NVIDIA, Gemini, Kimi, Cerebras, DeepSeek, Mistral, OpenAI, Z.ai

---

## 🚀 Installation locale (Windows / Mac / Linux)

### Prérequis

1. **Node.js 22+** (LTS recommandé) — vérifiez avec `node -v`
   - Windows/Mac : https://nodejs.org/
   - Linux (Debian/Ubuntu) : `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`

2. **Git** (optionnel mais recommandé pour les mises à jour)
   - https://git-scm.com/

### Étapes

#### 1. Décompressez ou clonez le projet

```bash
# Soit dézippez reseller-os.zip
# Soit clonez depuis GitHub :
git clone https://github.com/VOTRE_USER/reseller-os.git
cd reseller-os
```

#### 2. Installez les dépendances

```bash
npm install
```

#### 3. Configurez l'environnement

Créez un fichier `.env` à la racine :

```env
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="une-chaine-aleatoire-longue"
NEXTAUTH_URL="http://localhost:3000"
```

> 💡 Pour générer un secret fort : `openssl rand -base64 32` (Linux/Mac) ou utilisez n'importe quelle chaîne aléatoire de 32+ caractères.
>
> ⚠️ **Astuce Windows** : Pour éviter que `prisma db push` n'écrase votre `.env`, passez-le en lecture seule :
> ```cmd
> attrib +r .env
> ```

#### 4. Initialisez la base de données

```bash
npx prisma db push
npx prisma generate
```

#### 5. Chargez les données de démonstration

```bash
node scripts/seed.js
```

> Le seed crée : 6 fournisseurs, 15 articles, 10 ventes, 5 achats hors stock, 39 attributs, et quelques dépenses.

#### 6. Démarrez l'application

```bash
npm run dev
```

Application accessible sur **http://localhost:3000** 🎉

Au premier lancement (base vide), vous serez redirigé vers `/setup` pour créer le compte **admin** initial.

---

## 🌐 Déploiement en production (serveur Linux)

### Stack recommandée

- **VPS** ou serveur dédié (2 vCPU / 2 Go RAM minimum)
- **Node.js 22**
- **Nginx** (ou Caddy) en reverse proxy + SSL Let's Encrypt
- **PM2** pour la gestion des processus
- **Git** pour les mises à jour

### Installation initiale

```bash
# 1. Clonez le dépôt
cd /var/www
git clone https://github.com/VOTRE_USER/reseller-os.git
cd reseller-os

# 2. Installez Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Dépendances
npm install

# 4. Variables d'environnement
cp .env.example .env  # ou créez-le
nano .env
# DATABASE_URL="file:./db/custom.db"
# NEXTAUTH_SECRET="votre-secret-32-caracteres"
# NEXTAUTH_URL="https://votre-domaine.fr"

# 5. Base de données
npx prisma db push
npx prisma generate
node scripts/seed.js  # optionnel : données démo

# 6. Build production
npm run build

# 7. PM2
npm install -g pm2
pm2 start npm --name reseller-os -- start
pm2 save
pm2 startup  # active le démarrage automatique
```

### Configuration Nginx + SSL

```nginx
server {
    listen 80;
    server_name votre-domaine.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.fr;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.fr/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads (photos des articles)
    location /uploads/ {
        alias /var/www/reseller-os/public/uploads/;
        expires 30d;
    }
}
```

SSL avec Let's Encrypt :
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.fr
```

### Mises à jour via Git

```bash
cd /var/www/reseller-os
git checkout -- package-lock.json  # éviter les conflits
git pull origin main
npm install
npx prisma db push  # si le schéma a changé
npm run build
pm2 restart reseller-os
```

> 💡 Pour éviter les conflits récurrents avec `package-lock.json` :
> ```bash
> git update-index --skip-worktree package-lock.json
> ```

---

## 📂 Structure du projet

```
reseller-os/
├── prisma/
│   └── schema.prisma           # 13 modèles (User, StockItem, Sale, Supplier, etc.)
├── scripts/
│   └── seed.js                 # Données de démonstration
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker (offline cache)
│   └── uploads/                # Photos des articles (auto)
├── src/
│   ├── app/
│   │   ├── api/                # 30+ routes API REST
│   │   │   ├── auth/           # NextAuth (login, logout, session)
│   │   │   ├── stock/[id]/qrcode/  # Génération QR code PNG
│   │   │   ├── ai/             # description, analyze-photo, config
│   │   │   ├── accounting/     # livre-recettes, registre-achats, urssaf
│   │   │   ├── invoices/       # factures PDF
│   │   │   └── ...
│   │   ├── login/              # Page de connexion
│   │   ├── setup/              # Wizard premier admin
│   │   ├── scan/               # PWA scan QR code mobile
│   │   ├── layout.tsx          # SessionProvider + ConfirmProvider + SW
│   │   └── page.tsx            # Shell principal + sidebar + 10 modules
│   ├── components/
│   │   ├── modules/            # 10 modules métier + users-management
│   │   ├── shared/             # confirm-provider, reminder-popup, sw-register
│   │   └── ui/                 # Composants shadcn/ui
│   ├── hooks/                  # use-fetch, use-settings
│   ├── lib/
│   │   ├── auth.ts             # NextAuth config
│   │   ├── session.ts          # requireAuth, requireAdmin
│   │   ├── constants.ts        # Plateformes, statuts, transporteurs
│   │   ├── db.ts               # Client Prisma
│   │   ├── invoice.ts          # Numérotation factures
│   │   ├── store.ts            # Zustand store
│   │   └── utils.ts
│   └── middleware.ts           # Protection routes (sauf /scan, /uploads, /login)
├── .env                        # Variables (NON versionné)
├── Caddyfile                   # Config alternative Caddy
├── package.json
└── next.config.ts
```

---

## 🎯 Les 10 modules

| # | Module | Fonctionnalités |
|---|--------|-----------------|
| 1 | **Tableau de bord** | KPIs (CA, bénéfice net avec cotisations URSSAF, ROI, marge), évolution 6 mois, CA par plateforme, top marques |
| 2 | **Stock** | Articles avec SKU/code-barres, marque/taille/couleur/état, emplacement (entrepôt/rack/étagère/bin), multi-plateformes, **QR codes téléchargeables et imprimables**, photos, **export zip produit pour Vinted** |
| 3 | **Sourcing** | Fournisseurs (friperie, grossiste, destockeur, vide-grenier, particulier, fournisseur divers) avec SIRET et ROI |
| 4 | **Publication** | Kanban : À photographier → À rédiger → Prêt → Publié → Réservé → Vendu (multi-plateformes simultanées) |
| 5 | **Ventes** | Historique complet avec **numéro de facture**, plateforme, client, prix, marge, profit, transporteur, frais fixes |
| 6 | **Colis** | Kanban : À préparer → À imprimer → À déposer → En transit → Livré → Problème |
| 7 | **Rentabilité** | Dashboard financier avec graphiques (CA, bénéfice net après URSSAF, coûts, ROI par fournisseur) |
| 8 | **Fiscalité** | **Livre des recettes**, **registre des achats**, **cotisations URSSAF** + déclarations, exports CSV/Excel/PDF |
| 9 | **Intelligence métier** | Top marques par profit, temps moyen de vente, performance par catégorie |
| 10 | **Vinted Deals** | Recherche en temps réel sur le catalogue Vinted + mode "Deals" (articles peu favoris) + alertes automatiques |
| 11 | **Shooting Photo** | Sessions photos produits avec caméra mobile, puis rattachement aux fiches stock |
| 12 | **Paramètres** | Attributs (catégories, états, tailles, couleurs, transporteurs avec URL de suivi), **config IA** (10 providers), **taux URSSAF**, **rappels**, **utilisateurs** (admin) |

---

## 🔐 Multi-utilisateur & rôles

### Rôles

| Rôle | Accès |
|------|-------|
| **Admin** 👑 | Tous les modules, y compris Fiscalité, Rentabilité, Utilisateurs, Paramètres complets, Re-seed démo |
| **Staff** 👤 | Stock, Sourcing, Publication, Ventes, Colis, BI, Paramètres (lecture seule pour les attributs) |

- Les données sont **isolées par utilisateur** (chaque utilisateur ne voit que ses articles, ventes, fournisseurs, dépenses)
- Les **attributs** (catégories, états, tailles, couleurs, transporteurs) sont **partagés** entre tous les utilisateurs
- Le rôle Staff ne peut **pas** accéder aux modules Fiscalité et Rentabilité

### Setup wizard (premier lancement)

Au tout premier lancement (base vide), l'application redirige automatiquement vers `/setup` pour créer le **premier compte admin**. Une fois créé, `/setup` redirige automatiquement vers `/login`.

### Gestion des utilisateurs (admin uniquement)

Dans **Paramètres → Utilisateurs**, l'admin peut :
- Lister tous les comptes avec leur rôle et activité
- Créer un nouvel utilisateur (nom, email, mot de passe 8+ caractères, rôle admin/staff)
- Modifier un utilisateur (nom, rôle, réinitialiser le mot de passe)
- Supprimer un utilisateur (impossible de se supprimer soi-même ; impossible de supprimer le dernier admin)

---

## 📱 PWA Mobile & QR codes

### Application mobile installable

Reseller OS est une **PWA** (Progressive Web App). Sur mobile (Chrome/Android ou Safari/iOS) :

1. Ouvrez `https://votre-domaine.fr` sur votre téléphone
2. Menu → **Ajouter à l'écran d'accueil**
3. L'app s'ouvre en plein écran, sans barre de navigateur

### Scan de QR code en friperie

Page dédiée **`/scan`** accessible depuis le menu mobile :
- Ouvre la caméra du téléphone
- Scanne un QR code d'article
- Redirige automatiquement vers la fiche de l'article

> ⚠️ La caméra nécessite **HTTPS** (ou localhost). Sur HTTP, le navigateur bloque l'accès.

### QR codes pour les articles

Chaque article de stock a un QR code :
- **Téléchargeable** en PNG (400×400 px)
- **Imprimable** directement (bouton imprimer)
- Contient le **SKU** ou le **code-barres** de l'article
- Route API : `GET /api/stock/[id]/qrcode` → renvoie un PNG

Idéal pour étiqueter physiquement vos articles en entrepôt ou en friperie.

---

## 🤖 Intégration IA

### 10 providers supportés

L'application utilise une **API unifiée OpenAI-compatible** pour supporter 10 providers :

| Provider | Modèle recommandé | Usage |
|----------|-------------------|------|
| **Groq** | llama-3.3-70b-versatile | Rapide, gratuit |
| **Mistral** | mistral-large-latest | Bonne qualité FR |
| **OpenRouter** | meta-llama/llama-3.3-70b-instruct | Multi-modèles |
| **DeepSeek** | deepseek-chat | Rapide, économique |
| **Kimi** | moonshot-v1-8k | Bon pour le français |
| **Gemini** | gemini-2.0-flash | Multimodal |
| **NVIDIA** | nvidia/llama-3.1-nemotron-70b-instruct | Performant |
| **Cerebras** | llama3.1-70b | Ultra-rapide |
| **OpenAI** | gpt-4o-mini | Référence |
| **Z.ai** | glm-4-flash | Alternative |

Configuration dans **Paramètres → IA** : saisissez votre clé API (stockée localement, jamais envoyée ailleurs).

### Fonctionnalités IA

- **Génération de descriptions** : à partir de la marque, catégorie, état, taille → description Vinted/Leboncoin optimisée
- **Analyse de photos** : upload d'une photo → l'IA identifie marque, modèle, couleur, état estimé

---

## 💼 Conformité légale (France)

### Livre des recettes

Dans **Fiscalité → Livre des recettes** :
- Liste chronologique de toutes les ventes avec **numéro de facture**
- Filtre par mois/année
- Export PDF imprimable (format légal)
- Bouton **Reset** pour repartir de zéro

### Registre des achats

Dans **Fiscalité → Registre des achats** :
- Achats de stock (articles) **et** achats hors stock (fournitures, matières premières)
- SIRET du fournisseur affiché
- Méthode de paiement (CB, virement, espèces, chèque)
- Montant HT conditionnel (affiché uniquement si le fournisseur a un SIRET)
- Numéro de facture d'achat
- Filtre mensuel + export PDF
- Bouton **Reset**

### Cotisations URSSAF

Dans **Fiscalité → Cotisations URSSAF** :
- Configuration des taux (ventes de biens, prestations de services, charges sociales)
- Calcul automatique des cotisations dues par période
- Génération de **déclarations URSSAF** imprimables
- Le **bénéfice net** dans le tableau de bord et la rentabilité **intègre ces cotisations**

### Factures PDF

Chaque vente peut générer une **facture PDF** :
- Numérotation séquentielle configurable (préfixe + année + numéro)
- Paramètres de facturation (nom, adresse, SIRET, TVA)
- Génération serveur via HTML + `window.print()`

---

## 🛍️ Module Vinted Deals

Le module **Vinted Deals** (icône 🔍 dans la sidebar) permet de **rechercher en temps réel sur le catalogue Vinted** directement depuis Reseller OS. C'est un outil de **sourcing** : trouvez des articles à bas prix avec peu de favoris (donc peu concurrents) à acheter pour revendre avec marge.

### 2 modes de recherche

#### 1. Recherche classique (`/api/vinted/search`)
- Recherche par mot-clé (marque, modèle, type d'article)
- Filtres avancés :
  - **Tri** : plus récents, prix croissant/décroissant, plus de favoris
  - **Fourchette de prix** (min/max en €)
  - **État** : neuf avec étiquette, neuf sans étiquette, très bon, bon, satisfaisant
  - **Taille** (filtre textuel, ex: "M", "42", "S")
- 48 résultats par page

#### 2. Mode Deals (`/api/vinted/deals`)
- Scanne plusieurs pages (2 à 20, soit jusqu'à 1920 articles)
- Filtre les articles avec **peu de favoris** (0 à 10)
- Tri par ID (plus récents d'abord)
- Idéal pour repérer les **bons plans méconnus** que personne ne regarde

### Comment ça marche techniquement

L'API catalogique de Vinted (`/api/v2/catalog/items`) est publique mais protégée par **Cloudflare**. Le module utilise une stratégie en 2 temps :

1. **curl-impersonate** (si disponible) : binaire qui simule parfaitement un Chrome réel, bypass Cloudflare
2. **Fallback fetch natif** : avec headers de navigateur + gestion des cookies

Pour installer curl-impersonate sur votre serveur Linux (optionnel mais recommandé) :

```bash
# Sur le serveur Linux (Debian/Ubuntu)
mkdir -p /var/www/reseller-os/bin
cd /tmp
# Téléchargez la dernière version de curl-impersonate
wget https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz
tar xzf curl-impersonate-v0.6.1.x86_64-linux-gnu.tar.gz
cp curl-impersonate-chrome /var/www/reseller-os/bin/
chmod +x /var/www/reseller-os/bin/curl-impersonate-chrome
pm2 restart reseller-os
```

> 💡 Sans curl-impersonate, le module fonctionne quand même via fetch natif, mais peut être bloqué plus souvent par Cloudflare (erreurs 403/503).

### Routes API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/vinted/search` | GET | Recherche classique avec filtres |
| `/api/vinted/deals` | GET | Trouve des deals (peu de favoris) |
| `/api/vinted/sizes` | GET | Liste les tailles disponibles pour une requête |
| `/api/vinted/conditions` | GET | Mapping des états (new_with_tags → 1, etc.) |

Toutes les routes nécessitent une authentification (session NextAuth valide).

### ⚠️ Bon usage

- Ce module est en **lecture seule** (consultation du catalogue public)
- Aucune donnée n'est **envoyée** vers Vinted — pas de risque pour votre compte
- Vinted peut **temporairement bloquer** l'accès en cas de requêtes trop fréquentes (403/503) — patientez quelques minutes
- **Ne pas abuser** : attendez quelques secondes entre chaque recherche
- Le mode Deals scanne plusieurs pages — utilisez-le avec parcimonie (2-5 pages suffisent en général)

---

## 📤 Export Zip Produit (pour Vinted)

Le module Stock intègre un **export zip par produit** conçu pour accélérer la création d'annonces sur Vinted. En 1 clic, vous téléchargez un zip contenant toutes les infos et photos du produit, prêtes à copier-coller.

### Contenu du zip

Quand vous cliquez sur "Export zip" dans la fiche détaillée d'un article, vous obtenez un fichier `marque-categorie-taille-couleur.zip` contenant :

```
marque-categorie-taille-couleur.zip
├── README.txt            # Workflow recommandé
├── infos.txt             # Toutes les infos du produit (formaté)
├── description.txt       # Juste la description (prête à copier)
├── vinted-template.txt   # Modèle optimisé Vinted (titre + description + prix)
└── photos/
    ├── 01.jpg            # Photo principale (toujours la 1ère)
    ├── 02.jpg
    ├── 03.jpg
    └── ...
```

### Workflow optimisé (1 min par produit sur Vinted)

1. **Ouvrez le zip** téléchargé
2. **Copiez le titre** depuis `vinted-template.txt` → collez dans Vinted
3. **Copiez la description** depuis `vinted-template.txt` (ou `description.txt`)
4. **Ajoutez les photos** depuis le dossier `photos/` (la `01` est la principale)
5. **Saisissez le prix** indiqué dans `infos.txt`
6. **Validez l'annonce** Vinted — terminé en ~1 minute !

### Comment accéder à l'export

- **Module Stock** → cliquez sur un article pour ouvrir la fiche détaillée
- En haut à droite, bouton **"Export zip"** (à côté de QR Code)
- Le zip se télécharge automatiquement

### Route API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/stock/[id]/export` | GET | Génère et télécharge le zip du produit |

Le zip est généré à la volée côté serveur (pas de stockage temporaire) avec la librairie `archiver`. Les photos sont numérotées (01, 02, ...) pour garder l'ordre logique (la première est toujours la photo principale de l'article).

---

## 📸 Module Shooting Photo

Le module **Shooting Photo** (icône 📷 dans la sidebar) est conçu pour les revendeurs qui font des séances photos de leurs produits. Il permet de capturer les photos pendant le shooting via la caméra du téléphone (mobile/PWA), puis de les rattacher facilement aux fiches de stock plus tard.

### Workflow recommandé

1. **Pendant le shooting** (sur mobile, via PWA installée) :
   - Allez dans **Shooting Photo** → "Nouvelle session"
   - Donnez un nom mémo (ex: "T-shirt Nike M noir", "Lot jeans Levi's 38")
   - Cliquez sur "Ajouter photos" → la caméra du téléphone s'ouvre
   - Prenez plusieurs photos (devant, dos, étiquette, défauts...)
   - Les photos sont uploadées immédiatement sur le serveur

2. **Plus tard, sur ordinateur** :
   - Allez dans **Stock** → éditez l'article concerné
   - Section **Photos** → bouton "Importer depuis shooting"
   - Sélectionnez la session → toutes les photos sont rattachées en 1 clic

### Fonctionnalités

- ✅ **Caméra mobile native** : utilise `<input capture="environment">` (ouverture directe de l'appareil photo sur mobile)
- ✅ **Multi-photos** par session (illimité)
- ✅ **Upload immédiat** via WiFi/4G pendant le shooting
- ✅ **Aperçu grille** des photos dans chaque session
- ✅ **Suppression** de photos individuelles ou de la session entière
- ✅ **Rattachement** à un article de stock en 1 clic
- ✅ **Badge "Rattaché"** sur les sessions déjà importées
- ✅ **Stockage local** : photos dans `/public/uploads/sessions/{sessionId}/`

### Routes API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/photo-sessions` | GET, POST | Liste / création de sessions |
| `/api/photo-sessions/[id]` | GET, PATCH, DELETE | Détails / modification / suppression |
| `/api/photo-sessions/[id]/photos` | POST | Upload de photos (multipart/form-data) |
| `/api/photo-sessions/[id]/photos?photoId=X` | DELETE | Supprime une photo spécifique |
| `/api/photo-sessions/[id]/attach` | POST | Rattache une session à un article de stock |

### Astuce mobile

Pour une expérience optimale sur mobile :
1. Installez la PWA (Ajouter à l'écran d'accueil)
2. Ouvrez l'app sur votre téléphone pendant le shooting
3. Les photos sont uploadées en direct sur votre serveur
4. De retour au PC, elles sont prêtes à être rattachées

### 📨 Alertes automatiques (recherches sauvegardées)

Le module Vinted Deals intègre un système d'**alertes automatiques** : sauvegardez vos recherches, et le serveur scannera Vinted toutes les N heures pour détecter les nouvelles annonces.

#### Comment ça marche

1. **Sauvegardez une recherche** depuis l'onglet Recherche ou Deals → bouton "Sauvegarder"
2. Donnez un nom + choisissez l'intervalle de scan (1h à 1 semaine, 6h recommandé)
3. Le **cron serveur** déclenche le scan automatique
4. Les **nouvelles annonces** (IDs non vus) créent des alertes
5. Consultez-les dans l'onglet **"Mes alertes"** (badge rouge avec compteur)

#### Configuration du cron serveur (obligatoire)

Le scan automatique nécessite un cron Linux qui appelle l'endpoint `/api/cron/vinted-scan` toutes les heures.

**1. Ajoutez `CRON_SECRET` au fichier `.env`** (sur le serveur) :
```env
CRON_SECRET="une-chaine-aleatoire-longue-de-32-caracteres-minimum"
```

Générez-le avec :
```bash
openssl rand -base64 32
```

**2. Ajoutez au crontab Linux** :
```bash
# Éditez le crontab
crontab -e
```

Ajoutez la ligne suivante (exécution toutes les heures) :
```cron
0 * * * * curl -s -X POST -H "Authorization: Bearer VOTRE_CRON_SECRET" https://votre-domaine.fr/api/cron/vinted-scan > /dev/null 2>&1
```

Remplacez `VOTRE_CRON_SECRET` par la valeur de votre `.env`.

**3. Redémarrez PM2** (pour prendre en compte la nouvelle variable d'env) :
```bash
pm2 restart reseller-os
```

#### Vérification

Pour tester manuellement le scan :
```bash
curl -X POST -H "Authorization: Bearer VOTRE_CRON_SECRET" https://votre-domaine.fr/api/cron/vinted-scan
```

Réponse attendue :
```json
{
  "scannedAt": "2026-06-30T15:00:00.000Z",
  "scannedCount": 3,
  "results": [
    { "id": "abc123", "name": "T-shirts Nike M", "newAlerts": 2 },
    { "id": "def456", "name": "Jeans Levi's 38", "newAlerts": 0 }
  ]
}
```

#### Limites & bonnes pratiques

- **Intervalle minimum 1h** (imposé côté backend) pour éviter le rate-limit Vinted
- **6h recommandé** : bon compromis entre réactivité et respect de Vinted
- **Max 5 nouvelles alertes par scan** par recherche (évite le spam)
- **Fenêtre glissante de 500 IDs** mémorisés par recherche (les anciens sont oubliés)
- **Délai de 1.5s entre chaque recherche** lors d'un scan (anti rate-limit)
- Si Vinted bloque le scan (403/503), le scan est abandonné pour cette recherche mais réessaiera au prochain passage

#### Sans cron configuré

Si vous ne configurez pas le cron, vous pouvez quand même **sauvegarder des recherches** et les **consulter manuellement** dans l'onglet "Mes alertes". Mais les alertes ne se mettront pas à jour automatiquement — il faudra relancer des recherches manuellement.

### Variables d'environnement (optionnelles)

```env
# Domaine Vinted à utiliser (défaut: https://www.vinted.fr)
VINTED_DOMAIN=https://www.vinted.fr
```

---

## 🔔 Rappels & dépenses récurrentes

### Rappels

Dans **Paramètres → Rappels** :
- Créez des rappels avec date, titre, description
- **Popup automatique** au démarrage de l'app si des rappels sont dus
- Marquage comme fait/archivé

### Dépenses récurrentes

Dans le module **Fiscalité** :
- Marquez une dépense comme **récurrente** (mensuelle, trimestrielle, annuelle)
- Elle est automatiquement dupliquée à chaque échéance
- Idéal pour les abonnements (Vinted Pro, outils, logiciels)

---

## 💾 Sauvegarde & restauration

### Backup

API dédiée pour exporter la base SQLite complète :
```bash
curl -X POST http://localhost:3000/api/maintenance/backup \
  -H "Cookie: next-auth.session-token=VOTRE_SESSION" \
  --output backup-$(date +%Y%m%d).db
```

### Restauration

```bash
curl -X POST http://localhost:3000/api/maintenance/restore \
  -H "Cookie: next-auth.session-token=VOTRE_SESSION" \
  -F "file=@backup-20260626.db"
```

> 💡 Automatisez avec cron : `0 3 * * * curl ...` pour un backup quotidien à 3h du matin.

---

## 🛠️ Commandes utiles

```bash
# Développement
npm run dev              # Serveur dev (port 3000) avec Turbopack
npm run lint             # Vérification ESLint

# Production
npm run build            # Build optimisé
npm start                # Démarrage production (après build)

# Base de données
npx prisma db push       # Applique le schéma
npx prisma generate      # Régénère le client Prisma
npx prisma studio        # Interface visuelle (http://localhost:5555)
node scripts/seed.js     # Re-charge les données démo

# PM2 (production)
pm2 status               # État des processus
pm2 logs reseller-os     # Logs en temps réel
pm2 restart reseller-os  # Redémarrage
pm2 stop reseller-os     # Arrêt
```

---

## 🆘 Dépannage

### "prisma: command not found"
```bash
npx prisma generate
```

### "NEXTAUTH no secret" / 404 sur /api/auth
Le fichier `.env` a été écrasé (souvent par `prisma db push`).
Recréez-le avec `NEXTAUTH_SECRET` et `NEXTAUTH_URL`, puis :
- **Windows** : `attrib +r .env` pour le protéger
- **Linux** : `chmod 600 .env`

### Base de données vide
```bash
node scripts/seed.js
```

### "The table `main.BoutiqueSettings` does not exist" (erreur P2021)
La base de données n'a pas été initialisée correctement. Sur Windows, le chemin `DATABASE_URL` absolu Linux ne fonctionne pas.

1. Ouvrez `.env` et vérifiez que `DATABASE_URL` utilise un chemin **relatif** :
   ```env
   DATABASE_URL=file:./db/custom.db
   ```
2. Supprimez l'ancienne DB corrompue :
   ```bash
   # Windows
   del db\custom.db
   # Linux/Mac
   rm db/custom.db
   ```
3. Recréez le dossier et poussez le schéma :
   ```bash
   mkdir db
   npx prisma db push
   npx prisma generate
   ```
4. Protégez le `.env` contre l'écrasement (Windows) :
   ```cmd
   attrib +r .env
   ```

### Conflit git sur package-lock.json (serveur)
```bash
git checkout -- package-lock.json
git pull origin main
# Ou définitivement :
git update-index --skip-worktree package-lock.json
```

### "Module not found" après git pull
Vous avez oublié `npm install` :
```bash
npm install
npm run build
pm2 restart reseller-os
```

### Caméra ne fonctionne pas (scan QR)
- Nécessite **HTTPS** en production (ou `localhost` en dev)
- Vérifiez que Nginx/Caddy a bien le SSL Let's Encrypt
- Sur iOS Safari, autorisez la caméra dans Réglages → Safari

### Port 3000 déjà utilisé
```bash
# Linux/Mac
PORT=3001 npm run dev
# Windows
set PORT=3001 && npm run dev
```

### Erreur de compilation TypeScript
```bash
rm -rf .next node_modules
npm install
npx prisma generate
npm run dev
```

### "Prisma Client not found" après changement de serveur
Le build a été fait sur une autre plateforme. Reconstruisez sur le serveur :
```bash
rm -rf .next node_modules
npm install
npx prisma generate
npm run build
pm2 restart reseller-os
```

---

## 📝 Données de démonstration

Le seed crée :
- **6 fournisseurs** (Grossiste X, Friperie du Centre, Déstockage Pro, Vide-grenier Vincennes, Particulier Leboncoin, Stock Luxe Paris)
- **15 articles** (Ralph Lauren, Carhartt, Patagonia, Nike, Adidas, Levis)
- **10 ventes** sur Vinted/Leboncoin/eBay/Vestiaire
- **5 achats hors stock** (fournitures, emballages)
- **39 attributs** (catégories, états, tailles, couleurs, transporteurs)
- **Quelques dépenses** (abonnements, fournitures, carburant)

Bouton **"Re-seed démo"** dans la sidebar (admin uniquement) pour réinitialiser à tout moment. Les comptes utilisateurs ne sont jamais supprimés.

---

## 📄 Licence

Projet personnel — usage libre.

---

**Développé avec Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui · Prisma · NextAuth**
