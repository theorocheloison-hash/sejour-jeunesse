# Rapport — Timeout de boot Scalingo liavo-frontend (12-13/07/2026)

**Date :** 13/07/2026 · **Commit du fix :** `88e49ec` (non poussé)
**Verdict : Next 16.2.10 standalone n'écoute pas sur `0.0.0.0` — il écoute sur l'IP
du hostname du container. Le check de boot Scalingo (60 s) ne voit jamais l'écoute
attendue. Prouvé par expérience dans le runtime Scalingo.**

## Chronologie (deployments Scalingo, UTC ; logs app en CEST = UTC+2)

| Deploy (UTC) | Commit | Statut | Boot observé (CEST) |
|---|---|---|---|
| 12/07 14:52 | 90a9a3b | success | 16:57:53 → Ready → rotation propre |
| 12/07 15:42 | b0a1ed3 | success | 17:46:09 → Ready → rotation propre |
| 12/07 16:27 | ae4c498 | **timeout** | 18:30:50 → Ready 0ms → **tué +74 s** |
| 12/07 16:33 | dc845a2 | **timeout** | 18:36:17 → Ready 0ms → **tué +87 s** |
| 13/07 10:50 | 2a07b7b | **timeout** | 12:54:32 → Ready 0ms → **tué +95 s** |

## Éliminations (chacune vérifiée, pas supposée)

1. **Le code** : `git diff --stat b0a1ed3..dc845a2` = 3 fichiers `.md` (85 lignes).
   Avec `PROJECT_DIR=frontend`, ils n'entrent pas dans l'image → contenu d'image
   identique au dernier succès.
2. **La chaîne de build** : diff intégral des logs de build succès (da9e45cc) vs
   échec (254c3af7) → identiques au timing près (10 s vs 11 s de compil). Node
   20.20.2, npm 10.8.2, Next 16.2.10 des deux côtés.
3. **La piste « cp -r trop lents / qui échouent »** (piste 1) : réfutée — les logs
   montrent `started with the command` → `✓ Ready` en <1 s sur chaque boot raté.
   node démarre, donc les cp ont réussi vite.
4. **Un changement d'env Scalingo** : env = `NEXT_PUBLIC_API_URL` + `PROJECT_DIR`
   uniquement. Formation 1×M inchangée (container courant créé au deploy du succès).
5. **Un incident plateforme déclaré** : scalingostatus.com → « no reported events »
   les 12 et 13/07, osc-fr1 « Good Service ».
6. **L'image elle-même** : un `restart` (13:30:35 CEST) du container — même contenu
   applicatif — passe la rotation en 25 s sans être tué. Le contenu boote.

## La preuve (piste 2 confirmée)

`frontend/.next/standalone/server.js` (généré par Next 16.2.10) :

```js
const hostname = process.env.HOSTNAME || '0.0.0.0'
```

Or le runtime container pose `HOSTNAME=<nom-du-container>` (visible dans chaque log
de boot : `Network: http://liavo-frontend-web-1:PORT`).

**Expérience 1 — one-off Scalingo, config actuelle :**
```
HOSTNAME=liavo-frontend-one-off-8960
LOOPBACK_REFUSED        ← connexion 127.0.0.1:8765 refusée
HOSTNAME_OPEN           ← connexion <hostname>:8765 ouverte
▲ Next.js 16.2.10 … ✓ Ready in 0ms
```
Le serveur n'écoute QUE sur l'IP du container. Exigence Scalingo (doc boot-errors) :
écouter sur `0.0.0.0:$PORT`. Le check de boot au déploiement ne voit pas l'écoute →
timeout 60 s → SIGTERM, alors que le trafic routé (qui vise l'IP du container),
lui, passe — d'où un container qui « marche » mais un deploy qui échoue.

**Expérience 2 — contre-épreuve, le fix :**
```
HOSTNAME=0.0.0.0 → LOOPBACK_OPEN
- Network:  http://0.0.0.0:8765
```

**Vérification locale du Procfile final :** `npm run build` (postbuild copie
static+public) puis `HOSTNAME=0.0.0.0 PORT=3999 node .next/standalone/server.js`
→ `Network: http://0.0.0.0:3999`, HTTP 200 via 127.0.0.1.

## Le maillon non prouvable d'ici

Pourquoi les déploiements passaient-ils AVANT 12/07 16:27 UTC avec le même bind ?
Les boots de juin (Next 16.1.6) et les 2 succès du 12/07 (16.2.10) montrent la même
signature `Network: http://<hostname>:PORT`. Quelque chose a changé côté plateforme
ce jour-là (méthode de sonde du boot, pool d'hôtes, version d'agent) — invisible et
invérifiable depuis l'extérieur, et rien n'est déclaré sur leur status page. Peu
importe pour nous : le bind hostname-only violait déjà le contrat documenté
(« listen on 0.0.0.0 ») ; le fix nous rend conformes et insensibles à leur sonde.
Optionnel : signaler à Scalingo (support@scalingo.com) qu'un durcissement non
annoncé du check de boot a cassé les apps Next standalone le 12/07 vers 16h UTC.

## Le fix (commit `88e49ec`)

1. **`frontend/Procfile`** :
   `web: HOSTNAME=0.0.0.0 node .next/standalone/server.js`
   (override scoped au process web — les one-offs gardent leur $HOSTNAME normal).
2. **Les `cp -r` sortent du boot** (ils consommaient le budget 60 s et n'ont rien à
   y faire) → hook npm `postbuild` : `frontend/scripts/prepare-standalone.mjs`
   (`fs.cpSync`, cross-platform — fonctionne aussi sous Windows, vérifié).

## Reste à faire (décision Théo)

- Pousser `88e49ec` (+ `2a07b7b` si pas encore fait) → le déploiement Scalingo
  suivant validera en conditions réelles.
- Après le deploy : vérifier `scalingo deployments` (status success) et que
  `www.liavo.fr` sert bien le NOUVEAU code (les erreurs « Failed to find Server
  Action » des clients au bundle périmé disparaîtront après rechargement).
