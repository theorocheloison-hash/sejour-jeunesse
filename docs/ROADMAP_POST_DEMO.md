# LIAVO — Roadmap post-demo LMDJ/IDDJ
> A attaquer uniquement apres validation commerciale (demo 28 avril 2026)

---

## Priorite 1 — Quick wins produit

### Coherence colos sur toute la plateforme (CRITIQUE avant demo hebergeur)
Objectif : un hebergeur en demo ne doit jamais voir de champ scolaire (niveau de classe, UAI, rectorat) quand le contexte est colo. Sinon il decroche immediatement ("vous vendez pour les colos mais c'est type scolaire").

**Sous-chantiers** (sequentiels, ~5-7 jours total) :

1. **Onboarding ORGANISATEUR avec typeStructure** — FAIT (29/04/2026)
   - Enum TypeStructure : COLLEGE_LYCEE, ECOLE_PRIMAIRE, MAIRIE, CENTRE_LOISIRS, ASSOCIATION, COMITE_ENTREPRISE, AUTRE
   - Onboarding conditionnel UAI scolaire vs structure libre

2. **Validation directeur generique** — EN COURS (Prompt CC #2)
   - Renommer libelles "signature directeur" en "envoi pour signature"
   - Signataire libre selon typeStructure (directeur ecole / president asso / elu / etc.)

3. **Suppression rectorat frontend + generation PDF dossier de declaration** — EN COURS (Prompt CC #3)
   - Cacher le bouton "Soumettre au rectorat" dans le dashboard
   - Remplacer par "Telecharger le dossier de declaration" (PDF recapitulatif)
   - L'organisateur envoie lui-meme par email a la DSDEN ou SDJES
   - Backend soumettreAuRectorat reste en place mais plus appele

4. **Adaptation formulaire invitation hebergeur** — A FAIRE (1 jour)
   - Aujourd'hui /dashboard/venue/inviter-enseignant 100% scolaire (niveauClasse, UAI)
   - Renommer en /inviter-client (URL neutre)
   - Sélecteur "Type d'organisateur" en début de formulaire
   - Conditionner les champs scolaires selon le choix
   - Pour les non-scolaires : champs libres (nom de structure, ville, code postal)

5. **Audit transverse libelles/champs scolaires** — A FAIRE (1-2 jours)
   - Parcourir tout le dashboard TEACHER, VENUE, dashboard collaboratif sejour
   - Identifier tous les champs/libelles qui n'ont pas de sens pour une colo :
     - "niveau de classe" → conditionnel ou "tranche d'age" si non scolaire
     - "etablissement scolaire" → "structure organisatrice"
     - "UAI" → cache si non scolaire
     - "rectorat", "DSDEN" → cache si non scolaire
     - "directeur d'ecole" → "signataire" generique
     - autres a identifier en passant la plateforme
   - Conditionner selon le typeStructure du sejour ou de l'utilisateur connecte

### Landing page — Direction A (screenshots produit)
- Ajouter 3-4 screenshots du dashboard dans le hero et les sections
- Bases sur retours qualitatifs de 3-5 personnes cibles (pas amis/famille)
- Refonte visuelle ambitieuse (video, motion design) uniquement apres donnees analytics
- Estime : 4h

### Notification centres APIDAE non inscrits
- Modifier demande.service.ts create() pour notifier les centres APIDAE sans compte
- Fire-and-forget, rate limit 7j via dernierEmailDemandeAt
- Prompt CC deja prepare et valide architecturalement
- Estime : 2-3h

### Integration APIDAE LMDJ
- Une ligne a ajouter dans syncApidae() une fois credentials recus d'Anaitis
- Estime : 15 min

---

## Priorite 2 — Features a forte valeur demo

### Pop-up aide IA a l'utilisation
- Assistant contextuel integre dans chaque page du dashboard
- Guide l'utilisateur sur les actions possibles selon le contexte
- Deja discute dans une conversation precedente — reprendre le brief
- Estime : 3-5 jours

### Planning IA — generation automatique
- Generer le planning semaine a partir du catalogue produits + contraintes (capacite moniteur, groupes)
- Deja partiellement implemente — valider que ca fonctionne avec les vrais produits Sauvageon
- Estime : 2-3 jours (si base existante solide)

### Menu auto-genere IA
- Generer les menus de la semaine a partir des regimes alimentaires et allergies renseignes dans les autorisations parentales
- Cas demo : vegetarienne (Chloe MOREAU), sans gluten (Alice BERNARD), allergie arachides (Lucas PETIT), allergie lait (Clara MASSON), allergie fruits a coque (Lilou BOYER), diabete (Zoe MERCIER)
- Integration avec le catalogue repas du Sauvageon (repas midi, repas soir, petit-dejeuner, gouter, panier repas)
- Estime : 3-5 jours

---

## Priorite 3 — Extensions fonctionnelles

### Appel d'offres transport
- Permettre a l'enseignant de lancer un appel d'offres transport en parallele de l'hebergement
- Nouveau type de demande, nouveaux fournisseurs (autocaristes)
- Necessite un nouveau role ou extension du role VENUE
- Estime : 2-3 semaines

### Blog parent/prof/eleve
- Espace de publication lie a un sejour (journal de bord)
- Parents suivent le sejour en temps reel (photos, textes, activites)
- Eleves contribuent (exercice pedagogique)
- Prof modere et publie
- Estime : 2-3 semaines

### Gestion RH integree (planning equipe hebergeur)
- Planning des equipes du centre (cuisine, menage, animation, encadrement)
- Affectation du personnel par sejour/activite
- Vue semaine/mois pour le directeur du centre
- Extension naturelle du dashboard venue
- Estime : 3-4 semaines

---

## Priorite 4 — Dette technique (avant deploiement backend)

### 15 erreurs TypeScript backend
- Prisma schema decale par rapport au code
- A investiguer et resoudre AVANT tout prochain deploiement backend
- Estime : 1-2 jours

### Refactoring DashboardShell
- Migrer teacher/page.tsx, director/page.tsx, venue/page.tsx vers composant unique
- 3 patterns de layout differents actuellement
- Estime : 4-6 jours, risque moyen

### JWT httpOnly cookie migration
- Deliberement differee post-demo (risque regression auth)
- Estime : 1-2 jours

### Chorus Pro production
- Finaliser inscription AIFE (habilitation tiers mandate)
- Creer ChorusProService NestJS
- Variables Railway PISTE_CLIENT_ID + PISTE_CLIENT_SECRET
- Resoudre questions TVA sejours scolaires et valeur probatoire eIDAS

### RC Pro + Cyber insurance
- Hiscox ~500-700 EUR/an
- Differe post-demo

---

## Priorite 5 — Financement

Sequence validee :
1. Initiative Faucigny Mont-Blanc (membre CA, pret taux zero) — immediat
2. Start-up & Go Emergence post-SIREN — en cours
3. Reseau Entreprendre Haute-Savoie — 6 mois
4. BPI — 12-18 mois avec pilote rectorat
