# Audit 4.7 — Float→Decimal sur les montants (étape 1 : contrôle des données prod, SANS migration)

> **08/07/2026 — préparation seule, décidée par Théo.** Ce document contient les requêtes de contrôle
> à exécuter en prod (lecture seule) et la grille de lecture du résultat. La migration elle-même
> n'est PAS engagée : décision après lecture du rapport d'écarts. Jamais en overnight.

## 1. Le problème

Le schéma mélange deux types pour les montants du **même domaine facturation** :

- `Decimal(10,2)` : `devis.montant_total`, `devis.montant_par_eleve`, `produits_catalogue.prix`, `paiements.montant`, `hebergements.prix_par_jour` — exacts.
- `Float` (double précision IEEE 754) : tout le reste du cœur financier — `devis.montant_ht/tva/ttc/acompte/solde`, `lignes_devis.*`, `factures.*`, `lignes_facture.*`, `versements_paiement.montant`, `devis_libres` + lignes + versements, `factures_prestataires.montant_total_ttc`, `ventilations_sejour_prestataire.montant_ttc`.

Deux chemins d'arrondi asymétriques : `round2` est appliqué dans `facture.service.ts` (ligne 16) mais **pas** systématiquement à l'écriture des devis. Risque : montants stockés à plus de 2 décimales (ex. `1234.5600000000001`), incohérences HT+TVA≠TTC au centime, et non-conformité Factur-X EN 16931 (montants exacts à 2 décimales exigés dans le XML CII).

## 2. Requêtes de contrôle (prod, lecture seule)

Via `scalingo --app liavo-backend --region osc-fr1 pgsql-console`. Copier-coller bloc par bloc.

### Q1 — Valeurs stockées à plus de 2 décimales (l'écart Float brut)

```sql
SELECT 'devis.montant_ht' col, COUNT(*) FROM devis WHERE montant_ht IS NOT NULL AND montant_ht::numeric <> ROUND(montant_ht::numeric, 2)
UNION ALL SELECT 'devis.montant_tva', COUNT(*) FROM devis WHERE montant_tva IS NOT NULL AND montant_tva::numeric <> ROUND(montant_tva::numeric, 2)
UNION ALL SELECT 'devis.montant_ttc', COUNT(*) FROM devis WHERE montant_ttc IS NOT NULL AND montant_ttc::numeric <> ROUND(montant_ttc::numeric, 2)
UNION ALL SELECT 'devis.montant_acompte', COUNT(*) FROM devis WHERE montant_acompte IS NOT NULL AND montant_acompte::numeric <> ROUND(montant_acompte::numeric, 2)
UNION ALL SELECT 'devis.montant_solde', COUNT(*) FROM devis WHERE montant_solde IS NOT NULL AND montant_solde::numeric <> ROUND(montant_solde::numeric, 2)
UNION ALL SELECT 'devis.montant_verse_total', COUNT(*) FROM devis WHERE montant_verse_total::numeric <> ROUND(montant_verse_total::numeric, 2)
UNION ALL SELECT 'lignes_devis.prix_unitaire', COUNT(*) FROM lignes_devis WHERE prix_unitaire::numeric <> ROUND(prix_unitaire::numeric, 2)
UNION ALL SELECT 'lignes_devis.total_ht', COUNT(*) FROM lignes_devis WHERE total_ht::numeric <> ROUND(total_ht::numeric, 2)
UNION ALL SELECT 'lignes_devis.total_ttc', COUNT(*) FROM lignes_devis WHERE total_ttc::numeric <> ROUND(total_ttc::numeric, 2)
UNION ALL SELECT 'factures.montant_ht', COUNT(*) FROM factures WHERE montant_ht::numeric <> ROUND(montant_ht::numeric, 2)
UNION ALL SELECT 'factures.montant_tva', COUNT(*) FROM factures WHERE montant_tva::numeric <> ROUND(montant_tva::numeric, 2)
UNION ALL SELECT 'factures.montant_ttc', COUNT(*) FROM factures WHERE montant_ttc::numeric <> ROUND(montant_ttc::numeric, 2)
UNION ALL SELECT 'factures.montant_facture', COUNT(*) FROM factures WHERE montant_facture::numeric <> ROUND(montant_facture::numeric, 2)
UNION ALL SELECT 'factures.montant_verse_total', COUNT(*) FROM factures WHERE montant_verse_total::numeric <> ROUND(montant_verse_total::numeric, 2)
UNION ALL SELECT 'lignes_facture.prix_unitaire', COUNT(*) FROM lignes_facture WHERE prix_unitaire::numeric <> ROUND(prix_unitaire::numeric, 2)
UNION ALL SELECT 'lignes_facture.total_ttc', COUNT(*) FROM lignes_facture WHERE total_ttc::numeric <> ROUND(total_ttc::numeric, 2)
UNION ALL SELECT 'versements_paiement.montant', COUNT(*) FROM versements_paiement WHERE montant::numeric <> ROUND(montant::numeric, 2)
UNION ALL SELECT 'devis_libres.montant_ttc', COUNT(*) FROM devis_libres WHERE montant_ttc IS NOT NULL AND montant_ttc::numeric <> ROUND(montant_ttc::numeric, 2)
UNION ALL SELECT 'factures_prestataires.montant_total_ttc', COUNT(*) FROM factures_prestataires WHERE montant_total_ttc::numeric <> ROUND(montant_total_ttc::numeric, 2)
ORDER BY 2 DESC;
```

### Q2 — Cohérence interne devis : HT + TVA vs TTC (au centime)

```sql
SELECT id, numero_devis, montant_ht, montant_tva, montant_ttc,
       ROUND((montant_ht + montant_tva)::numeric, 2) - ROUND(montant_ttc::numeric, 2) AS ecart
FROM devis
WHERE montant_ht IS NOT NULL AND montant_tva IS NOT NULL AND montant_ttc IS NOT NULL
  AND ABS((montant_ht + montant_tva) - montant_ttc) > 0.005;
```

### Q3 — Somme des lignes vs total du devis

```sql
SELECT d.id, d.numero_devis, d.montant_ttc,
       ROUND(SUM(l.total_ttc)::numeric, 2) AS somme_lignes,
       ROUND(SUM(l.total_ttc)::numeric, 2) - ROUND(d.montant_ttc::numeric, 2) AS ecart
FROM devis d JOIN lignes_devis l ON l.devis_id = d.id
WHERE d.montant_ttc IS NOT NULL
GROUP BY d.id, d.numero_devis, d.montant_ttc
HAVING ABS(SUM(l.total_ttc) - d.montant_ttc) > 0.005;
```

*(Si `lignes_devis.devis_id` n'est pas le nom exact de la FK, vérifier avec `\d lignes_devis`.)*

### Q4 — Factures : acompte + solde + avoirs vs TTC du devis

```sql
SELECT d.id, d.numero_devis, d.montant_ttc,
       ROUND(SUM(f.montant_facture)::numeric, 2) AS total_facture
FROM devis d JOIN factures f ON f.devis_id = d.id
GROUP BY d.id, d.numero_devis, d.montant_ttc
HAVING ABS(SUM(f.montant_facture) - d.montant_ttc) > 0.005
ORDER BY d.numero_devis;
```

*(Écart attendu et légitime pour les devis partiellement facturés — croiser avec le statut. Les avoirs sont négatifs, la somme les absorbe.)*

### Q5 — Versements vs montant_verse_total (facture)

```sql
SELECT f.id, f.numero, f.montant_verse_total,
       COALESCE(ROUND(SUM(v.montant)::numeric, 2), 0) AS somme_versements
FROM factures f LEFT JOIN versements_paiement v ON v.facture_id = f.id
GROUP BY f.id, f.numero, f.montant_verse_total
HAVING ABS(f.montant_verse_total - COALESCE(SUM(v.montant), 0)) > 0.005;
```

## 3. Grille de lecture

| Résultat | Conclusion |
|---|---|
| Q1 tout à 0 | Aucune dérive stockée : la migration = pur changement de type (`ALTER ... TYPE numeric(10,2) USING ROUND(col::numeric,2)`), aucune correction de données. |
| Q1 > 0 sur des colonnes | Dérive réelle : lister les lignes (`SELECT id, col FROM table WHERE ...`) et vérifier qu'un `ROUND` à 2 décimales ne change aucun montant facturé au centime (sinon, litige comptable possible → correction cas par cas AVANT migration). |
| Q2/Q3 non vides | Incohérences internes préexistantes — à corriger indépendamment du type (le passage en Decimal les fige, il ne les crée ni ne les répare). |
| Q4/Q5 non vides hors cas légitimes | Bug de flux à investiguer avant migration. |

## 4. Coût réel de la migration (pour la décision, PAS pour maintenant)

Le SQL est la partie facile. Le vrai coût est **côté code** : Prisma expose les colonnes `Decimal` comme des objets `Prisma.Decimal`, pas des `number`. Tous les sites qui font de l'arithmétique directe sur `montantTTC`, `montantAcompte`, etc. (backend : facture.service, devis.service, pilotage, centre.service KPIs ; frontend : tout `Number(devis.montantTTC)` existant est déjà défensif, le reste non) devront convertir explicitement. L'inventaire de ces sites fait partie du chantier, pas de cet audit.

Ordre impératif le jour J (leçon 07/07) : SQL prod → push code, jamais l'inverse.

## 5. Prochaine étape

Théo exécute les requêtes § 2, colle les résultats, et la décision de migrer (ou pas, ou partiellement) se prend sur ce rapport d'écarts.
