# PASSE D'AJUSTEMENT #38 — n°2 (après recette du 03/09, 11h15)

> Suite de `docs/AJUSTEMENT_CC_38_2026-09-03.md` (rapport `docs/cc-reports/RAPPORT_AJUSTEMENT_38_2026-09-03.md`). Même cadre : règles du run, branche `feat/38-dashboard-organisateur`, baseline `4 failed / 445 passed`, `MOLLIE_API_KEY` exporté, **aucun push**. Rapport : nouvelle section « Passe n°2 » **ajoutée à la fin** du rapport d'ajustement existant (P11, P12, état final), commitée avec chaque point. Un commit par point : `fix(38/ajust-P11): …`, `fix(38/ajust-P12): …`.

## Validé à l'écran par Théo (ne pas retoucher)
P1→P10 : clôture depuis Inscriptions → pastille verte, emphase sur Budget ; Budget orange à solde négatif ; Réservation Devis | Documents officiels ; sous-onglets au gabarit ; envoi du lien journal avec confirmation ; dashboard carte à un bouton, nom du centre en texte ; deux modes visibles.

## P11 — Ordre du bloc Inscriptions (mode FAMILLES)
`page.tsx` : ordre = `InscriptionsEleves` (familles) → `TabParticipantsCollab` (grille de saisie + liste) → `Accompagnateurs`. Les accompagnateurs passent **en dernier**. Mode SAISIE : `TabParticipantsCollab` → `InscriptionsEleves` (replié) → `Accompagnateurs` (même règle : accompagnateurs en dernier). `ClotureInscriptions` reste sous la liste, avant les accompagnateurs. Liste blanche : `page.tsx`.

## P12 — Découverte des sous-onglets (sans clignotement)
Trois modifications, toutes dans `OrganisateurNav.tsx` / `SousOnglets.tsx` :
1. **Libellé du bloc** : quand un bloc a ≥ 2 vues, son libellé porte un suffixe discret « · N vues » (ex. « Sur place · 3 vues », « Échanges · 3 vues », « Réservation · 2 vues » si devis signé). Style plus léger que le libellé (opacité / taille réduite), pas un badge.
2. **Ligne d'aide à la première ouverture** : `useState` par bloc dans la session (pas de localStorage) — à la **première** ouverture d'un bloc multi-vues, une ligne au-dessus de la sous-barre : « Choisissez une vue : {libellés séparés par des virgules, dernier avec "ou"} » (ex. « Choisissez une vue : Planning, Groupes ou Chambres »), avec une petite flèche ↓ statique vers la sous-barre. Elle disparaît définitivement (pour la session) au premier clic sur un sous-onglet du bloc. Aucune animation clignotante ; une transition d'opacité ≤ 300 ms est acceptable.
3. **Vue par défaut de « Sur place » pour l'organisateur** : `groupes` au lieu de `planning` (le planning est en lecture seule pour l'enseignant ; sa tâche est la répartition). Uniquement dans `ONGLET_PAR_BLOC` (organisateur créateur) — `activeTab` fallback et `ACCOMPAGNATEUR_TABS` (accompagnateur ouvre sur planning) **inchangés**. Si `groupes` n'est pas dans `ongletsVisibles` (événement…), retomber sur le premier visible du bloc.
Liste blanche : `OrganisateurNav.tsx`, `SousOnglets.tsx`.

## Fin
Gates, rapport (section « Passe n°2 » avec `git log --oneline` des 2 commits + `git status`), aucun push. Recette Théo : ordre du bloc Inscriptions ; « · 3 vues » sur Sur place et Échanges ; ligne d'aide à la première ouverture qui disparaît au clic ; Sur place s'ouvre sur Groupes.
