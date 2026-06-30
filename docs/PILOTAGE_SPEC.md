# LIAVO — Module Pilotage : Spec technique

> **Date** : 30/06/2026
> **Statut** : validé par Théo — prêt à coder
> **Estimation** : ~3-4j (backend 2j + frontend 1-2j)
> **Décisions** : pas de colonne banque V1, comparaison N-1 masquée si pas de données, export comptable plan COMPLET, date échéance = J+30 après émission

---

## 1. Routing frontend

```
/dashboard/hebergeur/pilotage/
├── layout.tsx               ← sous-navigation (4 onglets)
├── page.tsx                 ← redirect → /ca
├── ca/page.tsx              ← CA + Remplissage
├── rentabilite/page.tsx     ← Marges (migration page existante)
├── comptabilite/page.tsx    ← Export factures + versements
└── equipe/page.tsx          ← "Bientôt disponible"
```

Onglets : `[CA & Remplissage] [Rentabilité] [Comptabilité] [Équipe 🏷️ Bientôt]`

Sidebar : item "Pilotage" dans la section Pilotage → pointe vers `/dashboard/hebergeur/pilotage`.
Redirect : `/dashboard/hebergeur/rentabilite` → `/dashboard/hebergeur/pilotage/rentabilite` (next.config.ts).

---

## 2. Endpoints backend

Nouveau module `backend/src/pilotage/` (controller + service + module).

### 2.1 — GET /pilotage/remplissage

**Plan requis** : PILOTAGE
**Query** : `?annee=2026`
**Guard** : `@Roles(Role.HEBERGEUR)` + `@RequirePlan('PILOTAGE')`

**Calcul** :
- Séjours confirmés : `statut` ∈ `[CONVENTION, SOUMIS_RECTORAT, SIGNE_DIRECTION, DECLARE_TAM]`
- Centre : `hebergementSelectionneId` = centre actif de l'user
- Exclusion : `deletedAt IS NULL`
- Participants par séjour : `placesTotales + (nombreAccompagnateurs ?? 0)`
- Nuitées par séjour sur le mois M : `jours_chevauchement(séjour, mois_M) × participants`
- Nuitées disponibles mois M : `capacite × jours_dans_mois_M`
- Taux mois M : `nuitéesOccupées_M / nuitéesDisponibles_M × 100`
- Taux annuel : `Σ nuitéesOccupées / Σ nuitéesDisponibles × 100`

**Réponse** :
```json
{
  "annee": 2026,
  "capacite": 100,
  "tauxAnnuel": 42.3,
  "nuiteesOccupees": 15440,
  "nuiteesDisponibles": 36500,
  "parMois": [
    { "mois": 1, "taux": 0, "nuiteesOccupees": 0, "nuiteesDisponibles": 3100, "nbSejours": 0 },
    { "mois": 3, "taux": 65.2, "nuiteesOccupees": 2020, "nuiteesDisponibles": 3100, "nbSejours": 4 }
  ],
  "comparaisonN1": null
}
```

`comparaisonN1` : `null` si aucun séjour confirmé sur l'année N-1. Sinon `{ tauxAnnuel: 38.1, evolution: "+4.2" }` (evolution en points).

### 2.2 — GET /pilotage/ca

**Plan requis** : PILOTAGE
**Query** : `?annee=2026`

**Calcul** :
- CA confirmé : somme `montantTTC` des devis non-complémentaires avec `statut` ∈ `[SELECTIONNE, SIGNE_DIRECTION, FACTURE_ACOMPTE, FACTURE_SOLDE]`, filtrés par date de séjour dans l'année
- CA encaissé : somme `VersementPaiement.montant` avec `datePaiement` dans l'année, rattachés aux devis du centre
- Reste à encaisser : CA confirmé − CA encaissé
- Ventilation par `natureSejour` (SEJOUR vs EVENEMENT)
- Ventilation par source (`sourceReseau` sur la demande vs direct)

**Réponse** :
```json
{
  "annee": 2026,
  "confirme": 209131,
  "encaisse": 135000,
  "resteAEncaisser": 74131,
  "parMois": [
    { "mois": 1, "confirme": 0, "encaisse": 0 },
    { "mois": 3, "confirme": 48000, "encaisse": 14400 }
  ],
  "parType": { "sejours": 125000, "evenements": 84131 },
  "parSource": { "direct": 180000, "reseau": 29131 },
  "comparaisonN1": null
}
```

`comparaisonN1` : `null` si aucun devis confirmé sur N-1. Sinon `{ confirme: 185000, evolution: "+13.0" }` (evolution en %).

### 2.3 — GET /pilotage/export/factures

**Plan requis** : COMPLET
**Query** : `?dateDebut=2026-01-01&dateFin=2026-12-31`
**Content-Type réponse** : `text/csv; charset=utf-8` avec BOM UTF-8
**Header** : `Content-Disposition: attachment; filename="factures_LIAVO_2026-01-01_2026-12-31.csv"`

**Colonnes CSV** (calquées sur le format comptable Sauvageon) :
```
Date;N°;Client;Montant Echéance;Date échéance;Date Paiement;Mode de paiement;Payé
15/03/2026;FA-2026-001;ECOLE MORILLON;1320.00;14/04/2026;15/03/2026;Virement;Oui
20/06/2026;FS-2026-001;ECOLE MORILLON;3080.00;20/07/2026;;Non
```

**Sources** :
- `Facture` : numero, dateEmission, typeFacture, montantFacture
- Client : `devis.sejourDirect.clientOrganisation ?? devis.sejourDirect.clientNom ?? devis.demande.enseignant.nom`
- Date échéance : `dateEmission + 30 jours`
- Date paiement : dernier `VersementPaiement.datePaiement` lié au devis (si montantVerseTotal >= montantFacture)
- Mode de paiement : dernier `VersementPaiement.modePaiement` (ou premier si plusieurs)
- Payé : `montantVerseTotal >= montantFacture` → "Oui" / "Non"

**Exclure** : factures de type AVOIR (elles ont un montant négatif, à traiter en V2).

### 2.4 — GET /pilotage/export/versements

**Plan requis** : COMPLET
**Query** : `?dateDebut=2026-01-01&dateFin=2026-12-31`
**Content-Type réponse** : `text/csv; charset=utf-8` avec BOM UTF-8

**Colonnes CSV** :
```
Date;Montant;Mode de paiement;Référence;N° Facture;Client;Séjour
15/03/2026;1320.00;Virement;VIR-2026-001;FA-2026-001;ECOLE MORILLON;Séjour Morillon APPN
```

**Sources** :
- `VersementPaiement` : datePaiement, montant, modePaiement, reference
- Facture : via `devis.factures` — prendre le numero de la facture la plus récente
- Client : même logique que 2.3
- Séjour : `devis.sejourDirect.titre ?? devis.demande.sejour.titre`

---

## 3. Frontend — Onglet CA & Remplissage

### KPIs header (3 cartes)
- CA confirmé (€, gros chiffre)
- CA encaissé (€)
- Reste à encaisser (€, couleur rouge si > 0)

### Graphique CA (recharts BarChart)
- Barres empilées mensuelles : confirmé (bleu #2563EB) + encaissé (vert #16A34A)
- Axe X : mois (Jan → Déc)
- Axe Y : montant €

### Ventilation (2 petits camemberts ou barres horizontales)
- Par type : Séjours vs Événements
- Par source : Direct vs Réseau

### Comparaison N-1
- Badge sous le KPI CA confirmé : "vs 185 000€ en 2025, +13.0%" avec flèche ↑
- **Masqué si `comparaisonN1 === null`**

### Séparateur visuel, puis :

### KPI remplissage (1 carte)
- Taux annuel (%) + nuitées occupées / disponibles

### Graphique remplissage (recharts BarChart)
- Barres mensuelles : hauteur = taux (%)
- Couleur par seuil : <40% rouge #DC2626, 40-70% jaune #F59E0B, >70% vert #16A34A
- Axe X : mois, Axe Y : % (0-100)

### Comparaison N-1 remplissage
- Badge : "vs 38.1% en 2025, +4.2 pts"
- **Masqué si `comparaisonN1 === null`**

---

## 4. Frontend — Onglet Rentabilité

Migration de la page existante `/dashboard/hebergeur/rentabilite/page.tsx`.
Pas de changement fonctionnel — le composant est déplacé dans la nouvelle structure de routes.
L'endpoint `GET /rentabilite/tableau?annee=2026` reste inchangé.

---

## 5. Frontend — Onglet Comptabilité

### Sélecteur de période
- Date début + Date fin (date pickers)
- Boutons raccourcis : "Année en cours", "Trimestre en cours", "Mois en cours"

### 2 boutons d'export
- 📥 Exporter les factures (CSV) → `GET /pilotage/export/factures?dateDebut=...&dateFin=...`
- 📥 Exporter les versements (CSV) → `GET /pilotage/export/versements?dateDebut=...&dateFin=...`

### Aperçu (optionnel V1)
- Tableau HTML des 10 dernières factures (même colonnes que le CSV) comme preview
- Lien "Télécharger le fichier complet" en bas

---

## 6. Frontend — Onglet Équipe

Page placeholder :
```
Planning équipe — Bientôt disponible
Gérez les plannings de vos équipes, moniteurs et intervenants.
Cette fonctionnalité est en cours de développement.
```

---

## 7. Modifications transversales

- `next.config.ts` : redirect `/dashboard/hebergeur/rentabilite` → `/dashboard/hebergeur/pilotage/rentabilite`
- `HebergeurSidebar.tsx` : item "Pilotage" → href `/dashboard/hebergeur/pilotage` (remplace "Rentabilité" → `/dashboard/hebergeur/rentabilite`)
- `ROUTE_PERMISSION` dans sidebar : ajouter `/dashboard/hebergeur/pilotage` → `'facturation'`

---

## 8. Pas de migration Prisma

Toutes les données existent. Le module est 100% lecture.
