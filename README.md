# KolisTrack

Application web personnelle pour suivre ses commandes passées en Chine (Taobao, 1688…)
jusqu'à leur récupération chez un transitaire à Madagascar. Les montants sont saisis en
yuan (CNY) et toujours convertis en ariary (MGA).

- **Stack** : Next.js 16 (App Router) · TypeScript · Prisma 7 + PostgreSQL (Neon) · Tailwind CSS 4 + shadcn/ui · Zod
- **Interface** : en français, pensée pour le téléphone (barre de navigation en bas, cartes), mode sombre automatique

## Fonctionnalités

| Page | Contenu |
| --- | --- |
| Tableau de bord `/` | Commandes par statut, montant en attente (MGA), total dépensé par mois (12 mois), commandes en attente depuis plus de 30 jours |
| Commandes `/commandes` | Recherche (code de suivi des articles, nom d'article, notes), filtres (statut, application, transitaire, dates), tri, cartes sur mobile / tableau sur ordinateur |
| Nouvelle / modifier | Ajout dynamique d'articles, frais d'application calculés automatiquement (modifiables), taux du jour pré-rempli (modifiable), estimation des frais transitaire depuis son tarif, totaux CNY et MGA en direct |
| Détail `/commandes/[id]` | Coûts, coût de revient par article, historique des statuts, « Changer le statut », « Marquer comme récupérée » (frais réels, poids, date) |
| Recherche colis `/recherche` | Un champ unique : ouvre directement la commande si le code correspond exactement |
| Paramètres `/parametres` | Applications (frais en % ou fixe) et transitaires (tarifs au kg / m³, devise) |

Le taux actuel (1 ¥ et 1 $ en Ar) est affiché dans l'en-tête, avec un convertisseur ¥ ⇄ Ar
accessible depuis toutes les pages.

### Règles de calcul

- **Sous-total CNY** = articles + frais application + livraison en Chine
- **Sous-total MGA** = sous-total CNY × taux CNY→MGA **figé** au moment de la commande
- **Frais transitaire MGA** = frais réels s'ils sont saisis, sinon estimés, convertis si la devise n'est pas le MGA
  (taux enregistré sur la commande ; à défaut, taux de la commande pour le CNY ou taux du jour pour l'USD)
- **Coût total MGA** = sous-total MGA + frais transitaire MGA
- Le total est affiché **« Définitif »** (frais réels saisis), **« Estimé »** (frais estimés) ou
  **« Estimé · sans transitaire »** (frais inconnus, non inclus)
- **Coût de revient par article** : les frais (application, livraison, transitaire) sont répartis au
  prorata de la valeur de chaque article
- L'estimation depuis le tarif du transitaire retient le plus élevé entre poids × tarif/kg et volume × tarif/m³

Tous les montants sont stockés en `Decimal` et calculés avec `decimal.js` (jamais de nombres flottants).

### Taux de change

Les taux CNY→MGA et USD→MGA viennent de <https://open.er-api.com/v6/latest/CNY> (gratuit, sans clé).
Ils sont mis en cache dans la table `TauxChange` et l'API est appelée au plus une fois par 24 h.
Si l'API ne répond pas, le dernier taux connu est utilisé (signalé par ⚠ dans l'en-tête).

### Codes de suivi

Ils sont enregistrés en majuscules et sans espaces : `yt 0001` et `YT0001` désignent le même colis.
Un code est unique, mais il peut rester vide et être ajouté plus tard, quand il est connu.

## Installation locale

Prérequis : Node.js 20.9+ (22 conseillé) et une base PostgreSQL (locale ou Neon).

```bash
npm install                     # installe les dépendances et génère le client Prisma
cp .env.example .env            # puis remplissez les variables (voir ci-dessous)
npm run db:migrate              # applique les migrations (prisma migrate dev)
npm run db:seed                 # ajoute des applications et transitaires d'exemple
npm run dev                     # http://localhost:3000
```

Variables d'environnement :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL utilisée par l'application |
| `DIRECT_URL` | *(optionnel)* Connexion directe Neon, utilisée par les migrations (sinon `DATABASE_URL`) |
| `APP_PASSWORD` | Mot de passe de connexion à l'application |
| `SESSION_SECRET` | Secret de signature des cookies de session : `openssl rand -base64 32` |

Autres commandes utiles :

```bash
npm run build        # prisma generate + next build
npm run lint
npm run db:studio    # explorer la base avec Prisma Studio
```

## Créer la base gratuite sur Neon

1. Créez un compte sur <https://neon.tech> (le plan gratuit suffit).
2. **Create project** : choisissez un nom (ex. `kolistrack`), la version de PostgreSQL proposée et une
   région proche (ex. *AWS Europe Central (Frankfurt)*).
3. Sur le tableau de bord du projet, cliquez sur **Connect**.
4. Laissez la base `neondb` et le rôle par défaut, puis copiez la chaîne de connexion :
   - avec **Connection pooling activé** (l'hôte contient `-pooler`) → `DATABASE_URL`
   - avec **Connection pooling désactivé** → `DIRECT_URL` (conseillé pour les migrations)
5. Vérifiez que les URL se terminent par `?sslmode=require`.
6. En local, placez-les dans `.env` puis lancez `npm run db:migrate` et `npm run db:seed`.

## Déploiement sur Vercel

1. Poussez le projet sur GitHub (le fichier `.env` est ignoré par git : ne le committez pas).
2. Sur <https://vercel.com>, cliquez sur **Add New… → Project** et importez le dépôt. Vercel détecte Next.js
   automatiquement.
3. Dans **Environment Variables**, ajoutez `DATABASE_URL`, `DIRECT_URL` (recommandé), `APP_PASSWORD` et
   `SESSION_SECRET` (générez un nouveau secret pour la production).
4. Cliquez sur **Deploy**.

Aucun réglage de commande de build n'est nécessaire : Vercel exécute automatiquement le script
`vercel-build` du `package.json` à la place de `build` :

```json
"vercel-build": "prisma generate && prisma migrate deploy && next build"
```

Les migrations sont donc appliquées à chaque déploiement. `postinstall` régénère aussi le client Prisma
après `npm install`.

Pour ajouter les données d'exemple sur la base de production (une seule fois, depuis votre machine) :

```bash
DATABASE_URL="<url Neon>" npm run db:seed
```

## Déploiement sur Render

Le fichier [`render.yaml`](render.yaml) (Blueprint) configure tout le service web. La base reste sur
**Neon** : la base PostgreSQL gratuite de Render expire au bout de 30 jours, contrairement à celle de Neon.

1. Poussez le projet sur GitHub (ou GitLab). Le fichier `.env` est ignoré par git.
2. Sur <https://dashboard.render.com>, cliquez sur **New → Blueprint**, connectez le dépôt, puis validez.
   Render lit `render.yaml` et crée le service `kolistrack` (plan gratuit, région Francfort).
3. Render demande les variables marquées `sync: false` :
   - `DATABASE_URL` : URL Neon **avec** `-pooler`
   - `DIRECT_URL` : URL Neon **sans** `-pooler` (utilisée par les migrations)
   - `APP_PASSWORD` : votre mot de passe de connexion

   `SESSION_SECRET` est générée automatiquement et `NODE_VERSION` vaut 22.
4. Cliquez sur **Apply**. À chaque déploiement, Render exécute :

   ```bash
   npm ci && npx prisma migrate deploy && npm run build   # build + migrations
   npm start                                              # démarrage (port fourni par Render)
   ```

5. L'application est disponible sur `https://kolistrack.onrender.com` (ou un nom proche si celui-ci est pris).

Pour ajouter les données d'exemple sur la base de production (une seule fois, depuis votre machine) :

```bash
DATABASE_URL="<url Neon>" npm run db:seed
```

> **Plan gratuit** : le service se met en veille après 15 minutes sans visite. La première ouverture qui
> suit prend alors environ une minute, le temps que Render le relance. Les données, stockées sur Neon,
> ne sont pas affectées.

Sans Blueprint, vous pouvez aussi créer un **New → Web Service** à la main avec les mêmes commandes de
build et de démarrage, et les mêmes variables d'environnement.

## Sécurité

- Application mono-utilisateur : mot de passe défini par `APP_PASSWORD`, comparé en temps constant.
- Session : cookie `httpOnly`, `SameSite=Lax`, `Secure` en production, signé en HMAC-SHA256 avec
  `SESSION_SECRET`, valable 30 jours. Changer `SESSION_SECRET` déconnecte toutes les sessions.
- `src/proxy.ts` (le « middleware » de Next.js 16) protège toutes les pages et routes `/api` :
  redirection vers `/login` pour les pages, réponse `401` pour l'API. Chaque Server Action revérifie
  la session.
- Tous les formulaires sont validés côté serveur avec Zod.

## Structure

```
prisma/
  schema.prisma            modèle de données
  migrations/              migration initiale
  seed.ts                  données d'exemple
prisma.config.ts           configuration Prisma 7 (URL, migrations, seed)
render.yaml                Blueprint de déploiement Render
src/
  proxy.ts                 protection des routes (authentification)
  app/
    login/                 page et actions de connexion
    (app)/                 pages protégées : tableau de bord, commandes, recherche, paramètres
    api/taux/              GET des taux actuels (JSON)
  components/              formulaire de commande, convertisseur, navigation, badges, ui/ (shadcn)
  lib/
    calculs.ts             calculs financiers (module pur, serveur et client)
    taux.ts                récupération et cache des taux de change
    validations.ts         schémas Zod
    session.ts, auth.ts    cookie de session signé
    commandes.ts           requêtes et sérialisation des commandes
    format.ts, statuts.ts  formatage (fr-FR, fuseau Indian/Antananarivo) et libellés
  generated/prisma/        client Prisma généré (non versionné)
```
