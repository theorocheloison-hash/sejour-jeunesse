# CHANTIER — Refonte de la saisie client à la création de séjour

> **Consigné le 03/09/2026** (session #39, pendant le run CC invitation).
> **Statut : cadrage NON figé — à instruire à froid après #39.** Aucune ligne de code écrite.
> **Déclencheur :** remontées terrain Anne (Choucas) + Maeva (Sauvageon) — « la recherche fonctionne mal », et l'étape Client de création de séjour ne dit pas quoi taper où. C'est **le geste le plus fréquent** de l'hébergeur : il doit devenir simple et intuitif.

---

## 0. Constat terrain

- Anne et Maeva se plaignent de la **recherche d'organisation** (mode Professionnel) et de la **confusion du formulaire** : nom d'établissement, contact, adresse — tout est entrelacé, on ne sait pas quoi saisir ni où.
- Le volet **Particulier est déjà bon** (prénom/nom, adresse, CP/ville, email/téléphone — propre). Capture 03/09 à l'appui. **On n'y touche pas.**

---

## 1. Ce qui confond aujourd'hui (lu sur le code, étape « Client » de `CreateSejourModal`)

Fichier : `frontend/app/dashboard/_shared/CreateSejourModal.tsx` (wizard 3 étapes Client → Séjour → Détails), qui monte `frontend/src/components/RechercheOrganisation.tsx`.

1. **Deux choix de type empilés qui font doublon** : en tête de l'étape, « 👤 Particulier / 🏢 Professionnel (SIRET) » ; puis, DANS `RechercheOrganisation`, un second choix « 🏫 Établissement scolaire / 🏢 Autre organisation ». L'utilisateur catégorise deux fois sans comprendre pourquoi.
2. **Deux zones réclamant le nom d'établissement, l'une sous l'autre** : le champ de recherche (nom + CP), puis un champ « Établissement » libre avec la micro-copie « la recherche pré-remplit ce champ ». Rien ne dit visuellement que le premier *nourrit* le second → on hésite : chercher en haut ? taper en bas ?
3. **Deux champs code postal de rôles différents** : celui de la recherche (filtre) et `clientCodePostal` (adresse de l'établissement). Même intitulé, deux fonctions.
4. **Contact et établissement entrelacés** dans l'ordre d'affichage : nom d'établissement → prénom/nom du contact → adresse/CP/ville de l'établissement → email/téléphone du contact. Ça alterne personne / structure / personne, sans séparation. L'œil ne peut pas regrouper.

**Interprétation :** ce formulaire a **accrété** (type client, puis recherche, puis champ manuel de secours, puis autocomplétion CRM sur le nom) sans repenser l'ensemble. C'est un empilement, pas un parcours.

---

## 2. Cible actée sur le PRINCIPE (à maquetter avant tout code)

**Séparer nettement deux entités :**
- **Établissement** = une structure : nom, adresse, CP, ville, (SIRET). *C'est ce qu'on facture.*
- **Contact** = une personne : prénom, nom, email, téléphone. *C'est à qui on parle / à qui part le devis + le lien de signature.*

**Un seul niveau de type**, qui devient le **routeur** (plus un doublon décoratif) :
- **Particulier** → contact seul (pas d'établissement). *Déjà bon aujourd'hui.*
- **Professionnel** → établissement + contact.

Le choix « scolaire / autre » **disparaît de l'UI** : il ne sert qu'en coulisses à router la source de recherche (annuaire Éducation nationale vs SIRENE), il n'a pas à être un choix exposé à l'hébergeur.

**Structure proposée (2 sections nettes) :**
1. **Type** : Particulier | Professionnel (un seul niveau).
2. **Établissement** (si Professionnel) : *un seul bloc*. Une barre de recherche ; à la sélection d'un résultat → une **carte « établissement sélectionné »** (nom + adresse + ville, éditable, avec un ✕ pour changer). Pas de résultat / structure absente → lien « saisir à la main » ouvrant les mêmes champs. **Le champ « Établissement » flottant sous la recherche disparaît** : c'est la recherche qui *devient* l'établissement.
3. **Contact** (toujours) : titré explicitement « Personne à contacter » — prénom, nom, email, téléphone regroupés. Pour un particulier, seule section visible.

---

## 3. Décisions NON tranchées (à poser au cadrage)

- **CP de recherche : obligatoire vs optionnel.** *Théo n'a pas voulu trancher (03/09).* Arbitrage : « moins taper » (Anne/Maeva, geste quotidien) vs « moins de bruit sur les grosses assos multi-sites ». Le gate actuel impose un CP à 5 chiffres à chaque saisie = friction sur le geste le plus fréquent.
- **Question à clarifier avant de commencer :** « la recherche fonctionne mal » = *ne trouve pas ce qu'elles cherchent* (moteur : résultats manquants/faux) OU *ne sait pas comment s'en servir* (ergonomie du champ) ? Les deux se traitent, mais ça change par quoi on commence.

---

## 4. Dettes techniques à instruire DANS le même chantier

- **Trois composants de recherche coexistent et divergent** : `RechercheOrganisation.tsx` (gate strict nom+CP, passe le CP), `OrganisationSearch.tsx` (1 seul champ, ne passe PAS le CP, interroge EN + SIRENE en parallèle), `StructureSearch` (register hébergeur). Ils dupliquent volontairement les mappings de type. **À consolider** — sinon on corrige un endroit et on oublie les autres.
- **Bug d'affichage « siège vs établissement »** (backend, 1 fichier). `backend/src/organisations/organisations.service.ts` → `mapResults` ne lit **que le siège** (`siege.code_postal / libelle_commune / geo_adresse`) et **ignore `matching_etablissements`**. Or l'API `recherche-entreprises.api.gouv.fr` filtre `code_postal` sur *tous les établissements* de l'unité légale et renvoie le siège → on cherche dans le 11 (ODCVL, antenne Aude), on affiche Épinal (88, siège). **Confirmé par la doc officielle de l'API + issue GitHub #171 du dépôt.** `auth.service.searchSirene` lit déjà `siege ?? matching_etablissements[0]` — le pattern existe, il n'a pas été appliqué à `mapResults`.
  - **Fix candidat (à la source) :** passer le `cp` reçu par `searchExternal` à `mapResults` ; quand un CP est filtré, dériver codePostal/ville/adresse de `matching_etablissements[0]` avec **fallback siège** si le tableau est vide. Option ciblée (le chemin sans CP `OrganisationSearch` garde le siège → zéro régression). **À CONFIRMER empiriquement** : que `matching_etablissements` soit peuplé dans la réponse (le domaine gouv n'est pas accessible au conteneur — ouvrir `https://recherche-entreprises.api.gouv.fr/search?q=ODCVL&code_postal=11370` dans un navigateur pour vérifier).
- **Sujet de fond signalé, hors fix d'affichage :** pour une structure nationale (ODCVL, OGEC, mairie), l'adresse de l'antenne ≠ le SIRET du payeur. Le fix d'affichage ne referme pas la question **payeur/structure** (déjà au backlog). Il ne fait que « ne plus mentir sur la localisation ».

---

## 5. Prérequis avant toute ligne de code

1. Census des **points de montage** de `CreateSejourModal` (planning, dashboard, CRM) — la refonte de l'étape Client les impacte tous.
2. Census des **trois composants de recherche** (divergences, source unique cible).
3. **Maquette figée** de la nouvelle étape Client (2 sections) validée par Théo.
4. Réponse à la question « moteur vs ergonomie » (§3).

**Ne PAS mêler ce chantier au run #39** (périmètre fermé, fichiers disjoints). À ouvrir en session dédiée après déploiement de #39.
