# INDEX JURIDIQUE LIAVO
**Dernière mise à jour : Avril 2026**

Ce fichier est l'index de référence de tous les documents juridiques de LIAVO SASU.
À lire en début de conversation pour avoir le contexte juridique complet.

---

## Identité juridique

| Élément | Valeur |
|---------|--------|
| Dénomination | LIAVO |
| Forme | Société par actions simplifiée unipersonnelle (SASU) |
| SIRET | 102 994 910 00010 |
| RCS | Annecy |
| EUID | FR7401.102994910 |
| N° gestion | 2026B00837 |
| Capital | 1 000 € |
| Siège | 472 Route du Mas Devant, 74440 MORILLON |
| Date immatriculation | 27/03/2026 |
| Date début activité | 23/03/2026 |
| 1er exercice clôture | 31/12/2026 |
| Président | Théo ROCHE-LOISON (né 27/10/1993 à Roanne) |
| Email | contact@liavo.fr |
| Site | https://liavo.fr |

**Associée unique :**
- SAS ROCHE-LOISON — SIREN 913 016 200 — RCS Annecy
- Siège : 472 Route du Mas Devant, 74440 MORILLON
- Représentée par Théo ROCHE-LOISON, Président

**Banque :**
- Crédit Agricole des Savoie — Agence Samoens
- IBAN : FR76 1810 6000 2796 7985 1267 389
- BIC : AGRIFRPP881

---

## Documents juridiques produits

### Société

| Document | Statut | Notes |
|----------|--------|-------|
| Statuts SASU LIAVO v2 | ✅ Signés 23/03/2026 | 17 articles, PI incluse |
| Convention de domiciliation Roche-Loison → LIAVO | ✅ Signée 23/03/2026 | Gratuite, convention réglementée |
| Acte de cession PI (code source → LIAVO SASU) | ✅ Signé | Couvre le repo sejour-jeunesse |
| Kbis LIAVO | ✅ Reçu 27/03/2026 | docs/juridique/kbis/ |
| Certificat dépôt actes greffe | ✅ 27/03/2026 | N° dépôt A2026/003763 |
| Registre bénéficiaires effectifs | ✅ 27/03/2026 | Théo ROCHE-LOISON 100% indirect |

### Marque & PI

| Document | Statut | Notes |
|----------|--------|-------|
| Marque LIAVO (INPI classes 35/38/42) | ✅ Déposée | Dépôt 2026 — en personne physique |
| Cession de marque INPI | 🔄 En cours | inpi.fr — 26€ — SIRET 102 994 910 00010 |

### Documents plateforme (en production sur liavo.fr)

| Document | URL | Statut |
|----------|-----|--------|
| Mentions légales | /legal/mentions-legales | ✅ En ligne — SIRET à jour |
| CGU établissements scolaires | /legal/cgu | ✅ En ligne |
| CGV hébergeurs | /legal/cgv-hebergeurs | ✅ En ligne — tarifs en placeholder |
| Politique de confidentialité | /legal/confidentialite | ✅ En ligne |
| Mandat de facturation Chorus Pro v1.1 | /legal/mandat-facturation | ✅ En ligne |

### Documents internes

| Document | Emplacement | Statut |
|----------|-------------|--------|
| Procédure violation données RGPD (Markdown) | docs/juridique/PROCEDURE_VIOLATION_DONNEES.md | ✅ |
| Procédure violation données RGPD (Word) | docs/juridique/ (.docx) | ✅ Produit en session |
| Mandat de facturation (Word complet) | docs/juridique/ (.docx) | ✅ Produit en session |
| Statuts v2 (Word) | docs/juridique/ (.docx) | ✅ Produit en session |
| Convention domiciliation (Word) | docs/juridique/ (.docx) | ✅ Produit en session |
| Checklist immatriculation | docs/juridique/ (.docx) | ✅ Produit en session |

---

## Sécurité backend — état post-corrections (Avril 2026)

| Point | Statut |
|-------|--------|
| CORS whitelist (liavo.fr uniquement) | ✅ Déployé |
| Logs credentials R2 supprimés | ✅ Déployé |
| Rate limiting @nestjs/throttler | ✅ Déployé — 60/min global, 10/min login, 5/h reset |
| Token vérification email 24h expiration | ✅ Déployé |
| Audit uploads — 0 URLs locales | ✅ Confirmé |
| Footer légal tous dashboards | ✅ dashboard/layout.tsx |
| JWT httpOnly cookie | ⏸ Différé post-démo |

---

## Obligations en cours / À faire

| Action | Priorité | Deadline |
|--------|----------|----------|
| Cession marque INPI (inpi.fr, 26€) | 🔴 Urgent | Cette semaine |
| RC Professionnelle LIAVO (Hiscox) | 🟠 Conditionnelle | Après démo LDMJ |
| Inscription PISTE/Chorus Pro (AIFE) | 🟠 Moyen terme | Après démo |
| CGV hébergeurs — tarifs définitifs | 🟡 Post-démo | Dès tarifs fixés |
| Expert-comptable premier exercice | 🟡 Post-démo | Avant 31/12/2026 |

---

## Points juridiques ouverts

1. **Qualification AIFE** : Statut LIAVO comme "concentrateur" vs "OD accrédité" non confirmé. Contact : api-choruspro.aife@finances.gouv.fr après inscription PISTE.

2. **TVA séjours scolaires** : Potentielle exonération art. 261-4-4° CGI. À valider avec avocat fiscaliste avant scaling.

3. **Mandat de facturation** : Solidement rédigé (9 articles, v1.1) mais valeur probante renforcée uniquement après implémentation email de confirmation post-acceptation (correction 2 du prompt dev mandat).

---

## Tech debt post-démo LDMJ

- Refactoring dashboards : migrer teacher/page.tsx, director/page.tsx, venue/page.tsx vers DashboardShell unifié. Estimé 4-6 jours. **Ne pas faire avant la démo.**
- JWT httpOnly migration auth (1-2 jours, changement breaking)
- 15 erreurs TypeScript backend pré-existantes à résoudre avant prochain déploiement backend

---

## Contacts clés

| Entité | Contact | Usage |
|--------|---------|-------|
| Crédit Agricole Samoens | 04 50 19 40 17 | Banque LIAVO |
| Greffe TC Annecy | 04 50 05 05 45 — greffe-tc-annecy.fr | RCS, modifications |
| INPI | inpi.fr | Marque, cession PI |
| CNIL | notifications.cnil.fr | Violation données |
| AIFE / Chorus Pro | api-choruspro.aife@finances.gouv.fr | Raccordement PISTE |
| Eco Savoie Mont Blanc | al@groupe-ecomedia.com | JAL annonces légales 74 |
| ANSSI | cybermalveillance.gouv.fr | Incident cybersécurité |
