# Procédure de Notification de Violation de Données Personnelles
**LIAVO SASU — Version 1.0 — Avril 2026**  
**Conformément à l'article 33 du RGPD (UE) 2016/679**  
**USAGE INTERNE CONFIDENTIEL**

---

## 1. Champ d'application

Toute violation de sécurité entraînant destruction, perte, altération, divulgation ou accès non autorisé aux données traitées par LIAVO :
- Données personnelles d'élèves mineurs (médicales, identité, contacts parentaux)
- Données enseignants, directeurs, agents rectorat
- Données financières hébergeurs (IBAN, SIRET, facturation)
- Données de connexion et logs d'accès

LIAVO agit en qualité de **responsable de traitement** (pour ses utilisateurs) ET de **sous-traitant** (pour les données élèves traitées pour le compte des établissements scolaires).

---

## 2. Classification des violations

| Niveau | Exemples | Obligations |
|--------|----------|-------------|
| **Faible** | Email au mauvais destinataire interne, erreur d'affichage sans exposition réelle | Documentation interne uniquement. Pas de notification CNIL. |
| **Moyen** | Accès non autorisé à données non sensibles (emails, noms établissements), perte de données sans exposition externe | Notification CNIL dans les 72h. Notification personnes si risque élevé. |
| **Élevé** | Exposition données médicales d'élèves mineurs, fuite IBAN hébergeurs, compromission base de données, ransomware | **Notification CNIL obligatoire <72h + Notification immédiate personnes concernées + Notification établissements scolaires** |

---

## 3. Timeline de réponse

> ⚠️ **CRITIQUE : 72 HEURES maximum pour notifier la CNIL (art. 33 RGPD)**

| Délai | Action | Responsable |
|-------|--------|-------------|
| **H+0 à H+2** | Identifier et confirmer la violation. Couper l'accès compromis / isoler le système. Capturer les logs et preuves. | Théo ROCHE-LOISON |
| **H+2 à H+4** | Classifier le niveau (Faible/Moyen/Élevé). Identifier catégories de données affectées, nombre de personnes, nature de l'exposition. | Théo ROCHE-LOISON |
| **H+4 à H+8** | Corriger la faille technique (déploiement correctif Railway). Changer credentials exposés. Réinitialiser tokens compromis. Documenter toutes les actions. | Théo ROCHE-LOISON |
| **< H+72** | **NOTIFICATION CNIL** sur notifications.cnil.fr avec toutes les informations requises. Conserver le récépissé. | Théo ROCHE-LOISON |
| **Simultanément si Élevé** | **NOTIFICATION ÉTABLISSEMENTS** : email à chaque directeur d'établissement affecté (modèle section 6). | Théo ROCHE-LOISON |
| **Simultanément si Élevé** | **NOTIFICATION PERSONNES CONCERNÉES** : email aux parents/enseignants/hébergeurs affectés (modèle section 7). | Théo ROCHE-LOISON |
| **J+30** | Rapport post-incident. Documentation complète. Archivage dans registre des violations. Mesures préventives documentées. | Théo ROCHE-LOISON |

---

## 4. Contenu de la notification CNIL

**URL : notifications.cnil.fr**

| Champ | Contenu à renseigner |
|-------|---------------------|
| Nature de la violation | Accès non autorisé / fuite / perte / altération — source identifiée ou supposée |
| Catégories de données affectées | Ex : données médicales élèves mineurs, données d'identification, IBAN hébergeurs |
| Nombre approximatif de personnes concernées | Nombre d'utilisateurs / d'élèves affectés |
| Nombre approximatif d'enregistrements | Volume de données exposées |
| Responsable de traitement | LIAVO SASU — Théo ROCHE-LOISON — contact@liavo.fr — SIRET 102 994 910 00010 |
| Conséquences probables | Impact potentiel sur les personnes concernées |
| Mesures prises ou envisagées | Confinement, correction, notification, mesures préventives futures |
| Notification différée (si > 72h) | Justification obligatoire du retard |

---

## 5. Registre des violations

**Obligation légale — conserver même les violations non notifiées à la CNIL.**  
**Durée de conservation : 5 ans.**

Pour chaque violation documenter :
- Date et heure de détection / de la violation
- Description de la violation
- Catégories et volume de données affectées
- Niveau de risque (Faible / Moyen / Élevé)
- Actions de confinement prises
- Notification CNIL : Oui/Non — si Oui, numéro de dossier CNIL
- Notification personnes concernées : Oui/Non
- Date de clôture de l'incident
- Mesures préventives déployées

---

## 6. Modèle email — Notification établissements scolaires

```
Objet : [URGENT] Notification de violation de données — LIAVO

Madame, Monsieur,

Nous vous informons qu'une violation de données personnelles a été détectée
sur la plateforme LIAVO le [DATE] à [HEURE].

Nature de la violation :
[Description précise et factuelle]

Données affectées :
[Catégories de données et volume]

Mesures prises :
[Actions de confinement et correction déployées]

Nous avons notifié la CNIL de cet incident le [DATE] (dossier n° [NUMÉRO CNIL]).

En tant que responsable de traitement, votre établissement peut être amené
à informer les familles des élèves concernés. Nous restons à votre disposition
pour vous fournir tout élément nécessaire à cette démarche.

Théo ROCHE-LOISON — Président LIAVO SASU — contact@liavo.fr
```

---

## 7. Modèle email — Notification personnes concernées

```
Objet : Information importante concernant la sécurité de vos données — LIAVO

Madame, Monsieur,

Nous vous contactons au sujet d'un incident de sécurité qui peut avoir
affecté vos données personnelles sur la plateforme LIAVO.

Ce qui s'est passé :
[Description claire et non technique]

Données potentiellement affectées vous concernant :
[Liste précise des données]

Ce que nous avons fait :
[Mesures correctives déployées]

Ce que vous pouvez faire :
— Si vous constatez une activité suspecte sur vos comptes, signalez-le
  immédiatement à votre banque ou aux services concernés.
— Pour toute question : contact@liavo.fr

Nous avons informé la CNIL de cet incident (dossier n° [NUMÉRO]).
Vous pouvez également déposer une plainte auprès de la CNIL sur cnil.fr.

Théo ROCHE-LOISON — Président LIAVO SASU — contact@liavo.fr
```

---

## 8. Contacts d'urgence

| Contact | Coordonnées |
|---------|-------------|
| **CNIL — Notification violation** | notifications.cnil.fr — formulaire en ligne 24h/24 |
| **CNIL — Contact général** | cnil.fr — 01 53 73 22 22 |
| **ANSSI (cyberattaque)** | cybermalveillance.gouv.fr |
| **Railway (hébergeur)** | help.railway.app |
| **Cloudflare R2 (stockage)** | dash.cloudflare.com |
| **Brevo (emails)** | app.brevo.com — suspendre les envois si nécessaire |

---

## 9. Checklist de réponse rapide

```
[ ] H+0  — Violation détectée et confirmée
[ ] H+0  — Accès compromis coupé / système isolé
[ ] H+0  — Logs et preuves capturés
[ ] H+2  — Niveau de risque classifié (Faible / Moyen / Élevé)
[ ] H+2  — Données affectées identifiées (catégories + volume + personnes)
[ ] H+4  — Faille technique corrigée et déployée
[ ] H+4  — Credentials/tokens compromis réinitialisés
[ ] <72h — Notification CNIL soumise (si Moyen ou Élevé)
[ ] <72h — Numéro de dossier CNIL reçu et archivé
[ ] <72h — Notification établissements scolaires envoyée (si Élevé)
[ ] <72h — Notification personnes concernées envoyée (si risque élevé)
[ ] J+30 — Rapport post-incident rédigé et archivé
[ ] J+30 — Mesures préventives déployées et documentées
```

---

*Document à réviser annuellement ou après tout incident.*  
*Version Word disponible dans le dossier docs/juridique/.*
