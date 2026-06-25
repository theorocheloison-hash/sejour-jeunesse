# DETTE TECHNIQUE — Actions de refactoring prioritaires

> **Rédigé le 15/06/2026** — constat issu de l'audit sécurité et de la lecture du code.
> **Dernière MAJ : 25/06/2026** — Action 2 DONE (LOT 1 sécu). Extractions TabNotes/SejourHeader/TabParticipants faites. TabDevisFacturation 109KB.
> **Statut** : aucune des 3 actions refacto n'est complète, mais du progrès incrémental.
> **Trigger** : lancer quand (1) un 2ᵉ dev arrive, (2) la vélocité chute visiblement, ou (3) le produit se stabilise post-clients.

---

## Constat

Le workflow CC (Claude Code) produit du code correct et fonctionnel à chaque prompt, mais optimise localement sans jamais nettoyer globalement. Résultat : duplication croissante, fichiers surdimensionnés, patterns copié-collés au lieu d'être factorisés. Ce n'est pas bloquant aujourd'hui (solo, pré-PMF), mais la dette s'accumule.

Signaux mesurés :
- `TabDevisFacturation.tsx` ~109 KB (un seul composant, était ~96 KB au 15/06)
- `sejour/[id]/page.tsx` ~3 200 lignes (3 composants extraits : SejourHeader, TabNotes, TabParticipantsSaisieDirecte)
- 3 fichiers DevisBuilder dupliqués (CatalogueSuggestionInput extrait — 1/3 du travail)
- Props DevisPDF construits en 2 endroits (DIRECT + COLLAB)
- 16 endpoints avec le même pattern de contrôle d'accès copié-collé → **résolu par LOT 1 sécu** (ownership.helper.ts)

---

## 3 actions, par ordre de ROI

### Action 1 — Fusionner les 3 DevisBuilder (~1-2j) — EN COURS

**Problème** : 3 fichiers dupliqués. Chaque modif devis = 3 fichiers à toucher, 3 chances de divergence silencieuse.

**Fix** : un seul composant `DevisBuilder` paramétrique (props pour distinguer les variantes). Supprimer les 2 copies.

**Progrès** : `CatalogueSuggestionInput.tsx` extrait en composant partagé (commit `2a16ad3`, 23/06). C'est ~1/3 du travail de déduplication.

**ROI** : immédiat sur chaque future modif devis. Plus de risque de divergence.

### Action 2 — Helper d'ownership partagé — ✅ DONE (LOT 1, 19/06/2026)

**Problème** : 16 endpoints avec des checks d'accès copié-collés, dont certains oublient le rôle SIGNATAIRE (= les IDOR de l'audit).

**Fix livré** : `backend/src/auth/ownership.helper.ts` avec 5 fonctions (`isSignataireLinkedToSejour`, `assertSignataireCanAccessSejour`, `assertSignataireCanAccessDemande`, `assertHebergeurCanAccessDemande`, `getSignataireSejourIds`). 17 sites IDOR fermés en 3 prompts CC + 1 cleanup.

### Action 3 — Découper `sejour/[id]/page.tsx` (~0,5j par onglet extrait) — EN COURS

**Problème** : 3 200 lignes dans un seul fichier orchestrateur. Difficile à naviguer, à comprendre pour un nouveau dev, à modifier sans régression.

**Fix** : extraire les onglets en composants selon le plan d'architecture existant (`docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` §7).

**Progrès (au 25/06/2026)** :
- ✅ `SejourHeader.tsx` — extrait
- ✅ `TabDevisFacturation.tsx` — extrait (109KB, gros mais autonome)
- ✅ `TabNotes.tsx` — extrait (textarea + timeline + rappels)
- ✅ `TabParticipantsSaisieDirecte.tsx` — extrait
- ❌ 8+ onglets restent dans page.tsx (extraction au fil de l'eau quand touché)

---

## Ce qui ne vaut PAS le coup

- Réécrire les services backend « plus proprement » sans raison fonctionnelle
- Réduire le nombre de lignes pour le principe
- Abstraire des patterns qui n'ont que 2 occurrences (seuil = 3 copies)
- Refacto global piloté par CC sans vision architecturale humaine
