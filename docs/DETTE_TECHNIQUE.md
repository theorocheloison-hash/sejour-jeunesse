# DETTE TECHNIQUE — Actions de refactoring prioritaires

> **Rédigé le 15/06/2026** — constat issu de l'audit sécurité et de la lecture du code.
> **Statut** : aucun code modifié. À planifier après validation commerciale LMDJ.
> **Trigger** : lancer quand (1) un 2ᵉ dev arrive, (2) la vélocité chute visiblement, ou (3) le produit se stabilise post-LMDJ.

---

## Constat

Le workflow CC (Claude Code) produit du code correct et fonctionnel à chaque prompt, mais optimise localement sans jamais nettoyer globalement. Résultat : duplication croissante, fichiers surdimensionnés, patterns copié-collés au lieu d'être factorisés. Ce n'est pas bloquant aujourd'hui (solo, pré-PMF), mais la dette s'accumule.

Signaux mesurés :
- `TabDevisFacturation.tsx` ~96 KB (un seul composant)
- `sejour/[id]/page.tsx` ~3 200 lignes
- 3 fichiers DevisBuilder dupliqués
- Props DevisPDF construits en 2 endroits (DIRECT + COLLAB)
- 16 endpoints avec le même pattern de contrôle d'accès copié-collé (trouvé par l'audit sécu)

---

## 3 actions, par ordre de ROI

### Action 1 — Fusionner les 3 DevisBuilder (~1-2j)

**Problème** : 3 fichiers dupliqués. Chaque modif devis = 3 fichiers à toucher, 3 chances de divergence silencieuse.

**Fix** : un seul composant `DevisBuilder` paramétrique (props pour distinguer les variantes). Supprimer les 2 copies.

**ROI** : immédiat sur chaque future modif devis. Plus de risque de divergence.

### Action 2 — Helper d'ownership partagé (~inclus dans LOT 1 sécu)

**Problème** : 16 endpoints avec des checks d'accès copié-collés, dont certains oublient le rôle SIGNATAIRE (= les IDOR de l'audit).

**Fix** : `auth/ownership.helper.ts` avec 4 fonctions (`isSignataireLinkedToSejour`, `assertSignataireCanAccessSejour`, `assertSignataireCanAccessDemande`, `assertHebergeurCanAccessDemande`). Remplace les 16 checks par des appels au helper.

**ROI** : double — fix sécu + refacto. Déjà analysé dans `docs/audits/REMEDIATION_IDOR_ANALYSE.md`. Fait partie du LOT 1 du plan de remédiation.

### Action 3 — Découper `sejour/[id]/page.tsx` (~0,5j par onglet extrait)

**Problème** : 3 200 lignes dans un seul fichier orchestrateur. Difficile à naviguer, à comprendre pour un nouveau dev, à modifier sans régression.

**Fix** : extraire les onglets en composants selon le plan d'architecture existant (`docs/ARCHITECTURE_UX_SEJOUR_FINAL.md` §7) :
- `SejourHeader.tsx` — barre contextuelle, infos client, liens
- `TabDevisFacturation.tsx` — déjà partiellement extrait mais ~96 KB
- `TabNotes.tsx` — textarea + timeline + rappels

**Méthode** : extraction ciblée, un onglet par session, uniquement quand on le touche pour une feature (règle P5 du doc d'archi — pas de big bang). Les 8 autres onglets restent dans page.tsx jusqu'à ce qu'on les touche.

**ROI** : lisibilité, maintenabilité, onboarding d'un 2ᵉ dev.

---

## Ce qui ne vaut PAS le coup

- Réécrire les services backend « plus proprement » sans raison fonctionnelle
- Réduire le nombre de lignes pour le principe
- Abstraire des patterns qui n'ont que 2 occurrences (seuil = 3 copies)
- Refacto global piloté par CC sans vision architecturale humaine
