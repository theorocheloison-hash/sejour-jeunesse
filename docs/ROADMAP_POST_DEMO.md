# LIAVO — Roadmap post-démo LMDJ/IDDJ
> Dernière mise à jour : 05/05/2026
> Résultat démo 28/04 : LMDJ intéressée (visio suivi à caler), IDDJ attentiste (CA à consulter)
> À attaquer uniquement après validation commerciale

---

## Priorité 0 — Actions immédiates (avant roadmap produit)

### RÈGLE ABSOLUE
**Aucune visio LMDJ, aucun onboarding tant que le refactor complet n’est pas finalisé. Si LMDJ voit des incohérences, pas de signature.**

**git add/commit/push passent par CC. PowerShell = SQL uniquement.**

### Prochains chantiers dans l’ordre (avant visio LMDJ)

1. ~~**SC5bis /centre/[id]/claim**~~ ✅ DÉPLOYÉ 04/05
2. ~~**SC4ter complétion**~~ ✅ DÉPLOYÉ 04/05
3. **SC9** — `StatutDevis` étendu + backfill + simplification `matchesOnglet()` — estimé 1j ← PROCHAIN
4. **CRM legacy** — migration `Client`/`ContactClient`/`Rappel` → `RelationCommerciale` — estimé 1j
5. **`typeContexte HORS_SCOLAIRE`** dans `soumettreDemandePublique()` — 0.5j
6. **`DECLARE_TAM`** dans `StatutSejour` — 0.5j

---

## Priorité 1 — Quick wins produit (déclencher après signal commercial)

### Cohérence colos sur toute la plateforme
Objectif : un hébergeur en démo ne doit jamais voir de champ scolaire (niveau de classe, UAI, rectorat) quand le contexte est colo.

**Sous-chantiers :**

1. **Onboarding ORGANISATEUR avec typeStructure** — ✅ FAIT (29/04/2026)
   - Enum TypeStructure : COLLEGE_LYCEE, ECOLE_PRIMAIRE, MAIRIE, COLLECTIVITE_TERRITORIALE, CENTRE_LOISIRS, ASSOCIATION, COMITE_ENTREPRISE, ENTREPRISE, MICRO_ENTREPRISE, AUTRE
   - Onboarding conditionnel UAI scolaire vs structure libre

2. **Validation signataire générique** — ✅ FAIT (SC4ter — bifurcation SCOLAIRE/HORS_SCOLAIRE dans /register/signataire)
   - Renommer libellés "signature directeur" en "envoi pour signature"
   - Signataire libre selon typeStructure

3. **Suppression rectorat frontend + génération PDF dossier de déclaration** — À FAIRE
   - Cacher le bouton "Soumettre au rectorat"
   - Remplacer par "Télécharger le dossier de déclaration" (PDF récapitulatif)
   - Backend soumettreAuRectorat reste en place mais plus appelé

4. **Adaptation formulaire invitation hébergeur** — À FAIRE (1 jour)
   - Renommer /dashboard/venue/inviter-enseignant en /inviter-client (URL neutre)
   - Sélecteur "Type d'organisateur" en début de formulaire
   - Conditionner les champs scolaires selon le choix

5. **Audit transverse libellés/champs scolaires** — À FAIRE (1-2 jours)
   - "niveau de classe" → conditionnel ou "tranche d'âge" si non scolaire
   - "établissement scolaire" → "structure organisatrice"
   - "UAI" → caché si non scolaire
   - "rectorat", "DSDEN" → caché si non scolaire
   - "directeur d'école" → "signataire" générique

### Envoi factures — flow "Transmettre au gestionnaire" (V2)
> Contexte : le chantier "Envoi facture par email" (juin 2026) a découplé émission et envoi.
> L'hébergeur peut envoyer la facture PDF par email à qui il veut. Mais en COLLAB,
> l'enseignant ne connaît pas toujours l'email du comptable.

**Flow cible :**
1. Hébergeur émet la facture → enseignant notifié ("facture dispo sur la plateforme")
2. Côté enseignant/signataire, bouton "Transmettre au gestionnaire" sur la facture
3. Saisie email du comptable → génération d'un token public (pattern `tokenSignature` du devis)
4. Le comptable reçoit un lien → page publique `/facture/[token]` → consulte + télécharge le PDF sans compte LIAVO
5. À terme : intégration Chorus Pro pour les collectivités publiques (cf. Priorité 3)

**Pré-requis :** champ `emailComptable` optionnel sur Organisation (pré-remplissage récurrents).
**Estimé :** 2-3 jours. **Trigger :** après premier séjour COLLAB facturé en production.

### Landing page — screenshots produit
- 3-4 screenshots réels du dashboard dans les sections de la landing
- Basés sur retours qualitatifs de 3-5 personnes cibles
- Estimé : 4h

### Notification centres APIDAE non inscrits (SC7)
- Modifier demande.service.ts create() → fire-and-forget notifierCentresApidae()
- Rate limit 7j via dernierEmailDemandeAt
- Prompt CC déjà préparé et validé architecturalement
- Estimé : 2-3h
- **Suspendu : validation commerciale LMDJ/IDDJ requise**

### Intégration APIDAE LMDJ
- Une ligne à ajouter dans syncApidae() une fois credentials reçus d'Anaïtis
- Estimé : 15 min

---

## Priorité 2 — Features à forte valeur demo

### Pop-up aide IA à l'utilisation
- Assistant contextuel intégré dans chaque page du dashboard
- Guide l'utilisateur sur les actions possibles selon le contexte
- Estimé : 3-5 jours

### Planning IA — génération automatique
- Générer le planning semaine à partir du catalogue produits + contraintes
- Partiellement implémenté — valider avec vrais produits Sauvageon
- Estimé : 2-3 jours

### Menu auto-généré IA
- Générer les menus de la semaine à partir des régimes alimentaires et allergies (autorisations parentales)
- Intégration avec catalogue repas du Sauvageon
- Estimé : 3-5 jours

### Intégrations externes — approche progressive
> Contexte : les hébergeurs type Sauvageon font du scolaire semaine + mariage/séminaire weekend.
> Besoin validé à confirmer avec Yves Massard et premiers clients onboardés.

**Phase 1 — Flux iCal lecture seule (0,5j)**
- Endpoint `GET /centres/:id/calendar.ics?token=xxx`
- Retourne tous séjours + indisponibilités en format .ics standard
- Compatible Google Calendar, Outlook, Apple Calendar, la plupart des PMS
- Token d'auth dans l'URL (pas de session)
- **Trigger :** dès qu'un hébergeur demande "voir mes séjours dans mon agenda"

**Phase 2 — Export CSV factures (0,5j)**
- Bouton "Exporter" dans le dashboard facturation
- CSV : numéro, date, client, HT, TVA, TTC, statut
- Import direct dans Pennylane / Henrri / comptable
- **Trigger :** dès qu'un hébergeur utilise un logiciel de compta

**Phase 3 — Webhooks événementiels (1-2j)**
- Modèle : `WebhookEndpoint { centreId, url, events[], secret, active }`
- Événements : sejour.created, devis.signed, facture.emitted, versement.added
- Ouvre la porte Zapier/Make/n8n sans connecteur natif
- **Trigger :** premier client qui demande une automation

**NON prévu (sauf signal récurrent 3+ clients) :**
- Intégrations PMS natives (Amenitiz, Reservit, Mews) — API propriétaires, semaines/connecteur
- Sync bidirectionnelle Google Calendar — complexité conflits, iCal suffit
- API publique OAuth2 — produit en soi, pas avant 50+ clients actifs

### Appel d'offres transport
- Nouveau type de demande, nouveaux fournisseurs (autocaristes)
- Impact schéma : à évaluer
- Estimé : 2-3 semaines

---

## Priorité 3 — Dette technique

### Refactoring DashboardShell
- Migrer organisateur/page.tsx, signataire/page.tsx, hebergeur/page.tsx → composant unique
- 3 patterns de layout différents actuellement
- Estimé : 4-6 jours, risque moyen

### JWT httpOnly cookie migration
- Délibérément différée post-démo (risque régression auth)
- Estimé : 1-2 jours

### Chorus Pro production
- Finaliser inscription AIFE (habilitation tiers mandaté)
- Créer ChorusProService NestJS
- Variables Scalingo PISTE_CLIENT_ID + PISTE_CLIENT_SECRET
- Résoudre questions TVA séjours scolaires et valeur probatoire eIDAS

### RC Pro + Cyber insurance
- Hiscox ~500-700€/an
- Différé post-démo

---

## Refonte page "Devis envoyés" (post-CA)

La page actuelle est une liste déroulante avec 7 onglets comptés. Problèmes identifiés :

- **Titre trompeur** : "Devis envoyés" ne couvre pas la réalité (inclut factures, impayés, acomptes)
- **Compteurs inutiles à l'échelle** : afficher "150" sur l'onglet "Facture solde" n'apporte rien — besoin de filtres (période, client, montant, statut paiement)
- **Pas de tri** : impossible de trier par date, montant, client. Une liste déroulante de 150+ items est inutilisable
- **Tooltips manquants** : les onglets (À facturer, Signé direction, etc.) ne sont pas explicites pour un hébergeur non technique — ajouter des tooltips explicatifs
- **Refonte cible** : tableau filtrable/triable avec recherche, pagination, export CSV. Les onglets deviennent des filtres combinables (statut × période × client). Le compteur devient un résumé contextuel ("7 devis à facturer pour 45 200 €")

Estimation : 2-3j. Dépendance : aucune. Priorité : post-validation commerciale LMDJ.

---

## Priorité 4 — Financement

Séquence validée :
1. Initiative Faucigny Mont-Blanc (membre CA, prêt taux zéro) — immédiat
2. Start-up & Go Emergence post-SIREN — en cours
3. Réseau Entreprendre Haute-Savoie — 6 mois
4. BPI — 12-18 mois avec pilote rectorat

## KPI "CA apporté par le réseau" (demande Marie Charvolin)

Besoin validé : l'hébergeur doit voir combien de séjours et de CA il a obtenu grâce aux appels d'offres relayés par son réseau (LMDJ, IDDJ, etc.).

Ancienne implémentation supprimée (17/06) : compteur "X séjours signés via LIAVO" sous "Demandes reçues" — mal placé et pas filtré par réseau.

Pistes de réintégration (à valider avec Marie le 18/06) :
- KPI card dédiée sur le dashboard hébergeur, filtrée par sourceReseau
- Section dans un futur dashboard réseau côté hébergeur
- Filtre "source" dans la page Devis & Facturation

Données disponibles : demandeId sur le devis (non-null = via appel d'offres), sourceReseau sur la demande/user.
