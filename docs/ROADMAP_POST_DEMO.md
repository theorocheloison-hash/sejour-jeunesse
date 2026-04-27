# LIAVO — Roadmap post-demo LMDJ/IDDJ
> A attaquer uniquement apres validation commerciale (demo 28 avril 2026)

---

## Priorite 1 — Quick wins produit

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
