# LIAVO — Tier 1 : Chantiers bloquants post-séjour DIRECT

> **Date** : 28/05/2026
> **Prérequis** : Session séjour DIRECT terminée (Phases 1-5 déployées)
> **Objectif** : 4 chantiers à exécuter dans l'ordre, chacun indépendant

---

## Chantier 1 — Notifications hébergeur sur messages collaboratifs (1h)

### Problème
Quand un organisateur poste un message dans l'espace collaboratif, l'hébergeur ne reçoit AUCUNE notification. L'email `notifierOrganisateur()` existe dans `collaboration.service.ts` mais ne notifie que l'organisateur (quand l'hébergeur écrit). Le symétrique n'existe pas.

### Fix
Dans `backend/src/collaboration/collaboration.service.ts`, méthode `createMessage()` :
- Après l'appel `notifierOrganisateur()`, ajouter un appel `notifierHebergeur()` quand c'est l'ORGANISATEUR qui poste.
- Créer la méthode privée `notifierHebergeur()` (symétrique de `notifierOrganisateur`) : charge `hebergementSelectionne.user.email`, envoie `sendGenericNotification()`.
- Même pattern pour `createJournalPost()`.

### Fichiers à modifier
- `backend/src/collaboration/collaboration.service.ts` — ajouter `notifierHebergeur()` + appels dans `createMessage()` et `createJournalPost()`

### Bugs cascade
- Ne pas notifier l'hébergeur s'il est lui-même l'auteur du message (même guard que `notifierOrganisateur` : `if (sejour.hebergementSelectionne?.userId === actionAuteurId) return`)
- Le `hebergementSelectionne` est déjà inclus dans `verifyAccess()` return — vérifier si `userId` et `user.email` sont chargés

---

## Chantier 2 — Liaison CRM ↔ séjours collaboratifs (1j)

### Problème
Les séjours collaboratifs existants (François Croquette, Christophe Migevant) n'apparaissent pas dans le CRM. Le flow collaboratif et le CRM sont deux silos. Le séjour DIRECT alimente le CRM automatiquement (linkSejourToClient dans sejour.service.ts), mais le flow collaboratif non.

### Fix — 2 sous-chantiers

**A. À l'acceptation d'une invitation :**
Dans `backend/src/invitation-collaboration/invitation-collaboration.service.ts`, méthode `accepter()`, APRÈS la transaction qui crée le séjour :
1. Chercher Client par `email === invitation.emailEnseignant` ET `centreId === invitation.centreId`
2. Si pas trouvé, chercher par `organisationId` (via UAI de l'enseignant)
3. Si pas trouvé, créer Client (nom = organisation.nom ou enseignant nom, type ETABLISSEMENT_SCOLAIRE, statut CLIENT)
4. Créer `SejourClient` (clientId, sejourId)
5. Créer `ActiviteClient` (type NOTE, "Séjour {titre} créé via invitation")
6. Si Client existant, mettre à jour `organisationId` si null

**B. Backfill des séjours existants :**
Script SQL à exécuter manuellement via `scalingo pgsql-console` :
```sql
-- Pour chaque séjour en CONVENTION qui n'a pas de SejourClient
INSERT INTO sejours_clients (id, client_id, sejour_id, created_at)
SELECT gen_random_uuid(), c.id, s.id, NOW()
FROM sejours s
JOIN centres_hebergement ch ON ch.id = s.hebergement_selectionne_id
JOIN demandes_devis dd ON dd.sejour_id = s.id
JOIN utilisateurs u ON u.id = dd.enseignant_id
JOIN clients c ON c.centre_id = ch.id AND c.email = u.email
WHERE s.statut IN ('CONVENTION', 'SIGNE_DIRECTION')
AND NOT EXISTS (SELECT 1 FROM sejours_clients sc WHERE sc.sejour_id = s.id AND sc.client_id = c.id)
LIMIT 100;
```

### Fichiers à modifier
- `backend/src/invitation-collaboration/invitation-collaboration.service.ts` — enrichir `accepter()`

### Bugs cascade
- `accepter()` a été modifié aujourd'hui (branchement séjour DIRECT). Le nouveau code de liaison CRM doit être APRÈS le branchement DIRECT (qui fait `return` si séjour DIRECT).
- Le Client peut ne pas avoir d'`organisationId`. Ne pas crash si null.
- `SejourClient` a un `@@unique([clientId, sejourId])` — utiliser `upsert` ou `ON CONFLICT DO NOTHING`.

---

## Chantier 3 — Nettoyage code mort DevisLibres (0.5j)

### Prérequis
Vérifier que la migration SQL Phase 5 a bien tourné en prod :
```sql
-- Via scalingo pgsql-console
SELECT COUNT(*) FROM devis_libres;
-- Puis vérifier les séjours migrés
SELECT COUNT(*) FROM sejours WHERE mode_gestion = 'DIRECT' AND nature_sejour = 'EVENEMENT';
-- Les deux counts doivent correspondre
```

### Actions si migration OK
**Backend — supprimer :**
- `backend/src/devis-libres/` (tout le dossier : controller, service, DTOs, module)
- Retirer `DevisLibresModule` de `app.module.ts`

**Frontend — supprimer :**
- `frontend/app/devis-libre/` (tout le dossier — le redirect next.config.ts gère les anciens liens)
- `frontend/app/dashboard/hebergeur/devis-libres/` (tout le dossier)
- `frontend/src/lib/devis-libres.ts`

**Frontend — nettoyer les imports :**
- Vérifier que rien n'importe depuis `@/src/lib/devis-libres` ou `devis-libre` dans le codebase
- La sidebar hébergeur avait peut-être un lien "Devis libres" → le supprimer

**Schema Prisma — NE PAS supprimer les modèles DevisLibre/LigneDevisLibre/VersementDevisLibre** tant que les tables sont en base. Les supprimer créerait une migration destructive. On les marquera `@@ignore` plus tard.

### Bugs cascade
- La sidebar hébergeur (`HebergeurSidebar`) peut avoir un lien vers `/dashboard/hebergeur/devis-libres` → le supprimer
- Le planning a été refactoré pour ne plus charger les DevisLibres (Phase 1 P2) → déjà clean
- Le hook `useHebergeurCounts` peut compter les devis libres → vérifier

---

## Chantier 4 — Labels universels page sejour/[id] (1-2j)

### Problème
La page de 5000 lignes `frontend/app/dashboard/sejour/[id]/page.tsx` utilise des termes scolaires partout : "Établissement scolaire", "Enseignant responsable", "Nombre d'élèves", "Élèves non affectés", "Clôturez les inscriptions pour affecter les élèves", "Lien avec les programmes scolaires".

Pour Quentin (UFCV, colos) et les événements, c'est incohérent.

### Approche
Prompt CC dédié — modifications chirurgicales (str_replace ciblés). Le fichier fait ~5000 lignes, on ne le réécrit pas.

**Remplacements :**
| Avant | Après |
|---|---|
| Établissement scolaire | Structure organisatrice |
| Enseignant responsable | Responsable du séjour |
| Nombre d'élèves | Nombre de participants |
| élèves | participants |
| Élèves non affectés | Participants non affectés |
| Clôturez les inscriptions pour affecter les élèves | Clôturez les inscriptions pour affecter les participants aux groupes |
| Lien avec les programmes scolaires | Lien avec les programmes |

**Conditionnel si possible :** utiliser `isEvenement` et `isDirect` (déjà disponibles depuis Phase 3B-1) pour adapter les labels dynamiquement. Par exemple, masquer "Lien avec les programmes" en mode EVENEMENT.

### Fichiers à modifier
- `frontend/app/dashboard/sejour/[id]/page.tsx` — ~15-20 remplacements de strings

### Bugs cascade
- Les PDFs (DevisPDF, BudgetPDF, PlanningPDF, ProjetPedagogiquePDF) ont déjà été universalisés session 27/05 → pas de conflit
- Le type `SejourCollabInfo` ne contient pas `niveauClasse` comme champ conditionnel — les labels conditionnels doivent utiliser `natureSejour` et `modeGestion` (déjà disponibles)
- Ne pas toucher aux labels dans les emails backend — c'est un chantier séparé

---

## Ordre d'exécution recommandé

1. **Chantier 1** (notifications) — 1 prompt CC, 1h, impact utilisateur immédiat
2. **Chantier 2** (liaison CRM) — 1 prompt CC + script SQL manuel, 1j
3. **Chantier 3** (nettoyage) — 1 prompt CC, vérification migration d'abord
4. **Chantier 4** (labels) — 1 prompt CC dédié, le plus long mais pas bloquant

Total estimé : 2-3 jours.
