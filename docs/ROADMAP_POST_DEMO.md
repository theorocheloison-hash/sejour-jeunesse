# LIAVO — Roadmap post-démo LMDJ/IDDJ
> Dernière mise à jour : 04/05/2026
> Résultat démo 28/04 : LMDJ intéressée (visio suivi à caler), IDDJ attentiste (CA à consulter)
> À attaquer uniquement après validation commerciale

---

## PRIORITÉ 0 — Actions immédiates (avant roadmap produit)

### RÈGLE ABSOLUE — à enregistrer définitivement
**Aucune visio LMDJ, aucun onboarding hébergeur tant que le refactor complet de LIAVO n’est pas finalisé (totalité du doc ARCHITECTURE_ORGANISATIONS.md). Si LMDJ voit des incohérences dans l’outil lors de la visio, il n’y aura pas de signature. L’objectif de la visio est de valider leur volonté d’intégrer leurs centres — ils doivent voir un outil fini.**

### 0.1 SC9 — Refactor StatutDevis (1 jour) — PRIORITÉ IMMÉDIATE
Bug : badge « Sélectionné » sur un devis signé/facturé. Cause : `SELECTIONNE` couvre 5 états distincts.
Solution : étendre `StatutDevis` avec `SIGNE_DIRECTION`, `FACTURE_ACOMPTE`, `FACTURE_SOLDE`.
Détail complet en section 5ter de `docs/ARCHITECTURE_ORGANISATIONS.md`.

Prérequis avant de coder :
1. Grep `typeDocument` dans tout le backend
2. Grep `signatureDirecteur` comme condition de routage
3. Décider si `typeDocument` est supprimé ou conservé en redondance
4. Script backfill SQL validé avant exécution en prod

### 0.2 Visio LMDJ — BLOQUÉE jusqu’à fin du refactor
- Ne pas caler la visio avant la fin de l’intégralité des sous-chantiers
- Voir `docs/ARCHITECTURE_ORGANISATIONS.md` pour la liste complète des chantiers restants

---

## Priorité 1 — Quick wins produit (déclencher après signal commercial)

### Cohérence colos sur toute la plateforme
Objectif : un hébergeur en démo ne doit jamais voir de champ scolaire (niveau de classe, UAI, rectorat) quand le contexte est colo.

**Sous-chantiers :**

1. **Onboarding ORGANISATEUR avec typeStructure** — ✅ FAIT (29/04/2026)
   - Enum TypeStructure : COLLEGE_LYCEE, ECOLE_PRIMAIRE, MAIRIE, COLLECTIVITE_TERRITORIALE, CENTRE_LOISIRS, ASSOCIATION, COMITE_ENTREPRISE, ENTREPRISE, MICRO_ENTREPRISE, AUTRE
   - Onboarding conditionnel UAI scolaire vs structure libre

2. **Validation signataire générique** — EN COURS
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

## Priorité 4 — Financement

Séquence validée :
1. Initiative Faucigny Mont-Blanc (membre CA, prêt taux zéro) — immédiat
2. Start-up & Go Emergence post-SIREN — en cours
3. Réseau Entreprendre Haute-Savoie — 6 mois
4. BPI — 12-18 mois avec pilote rectorat
