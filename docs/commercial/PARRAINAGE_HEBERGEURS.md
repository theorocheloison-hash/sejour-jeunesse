# Parrainage hébergeurs — Réseau commercial autonome

> **Idée capturée le 04/06/2026** — À approfondir, pas encore priorisée.
> **Objectif stratégique** : créer un réseau d'acquisition commercial autonome où les hébergeurs se cooptent entre eux, réduisant le coût d'acquisition sans force de vente.

---

## L'idée en une phrase

Un hébergeur LIAVO qui parraine un autre hébergeur reçoit une remise sur son abonnement tant que le filleul reste abonné.

---

## Questions ouvertes à trancher

### Mécanique de la remise
- Remise en % sur l'abonnement parrain (ex: -20% pendant 12 mois) ou remise fixe (ex: -5€/mois à vie) ?
- Remise immédiate ou conditionnée à l'activation payante du filleul ?
- Plafond : un parrain peut-il parrainer N filleuls et cumuler les remises jusqu'à 100% ? Si oui, quel plafond ?
- Remise réciproque (parrain + filleul ont tous les deux une remise le premier mois) ou unilatérale ?

### Durée
- Remise temporaire (ex: 6 ou 12 mois) ou permanente tant que le filleul est actif ?
- Permanent = intéressant pour le parrain mais crée une charge financière croissante pour LIAVO. À modéliser selon le LTV attendu.

### Traçabilité
- Lien de parrainage unique par hébergeur (généré depuis le dashboard) ?
- Code promo personnel (ex: `SAUVAGEON`) ou lien ?
- Lien recommandé : plus simple, zéro saisie, traçable automatiquement.

### Conditions d'éligibilité
- Parrain doit être sur plan payant (sinon il parraine pour ne rien avoir) ?
- Filleul doit activer un abonnement payant (pas juste s'inscrire en freemium) pour déclencher la remise ?
- Exclusion des structures LMDJ/IDDJ qui s'inscrivent via la plateforme réseau (canal déjà institutionnel) ?

---

## Hypothèses économiques à valider

| Paramètre | Hypothèse à tester |
|---|---|
| Taux de conversion parrainage → inscription payante | 30-50% (pairs = confiance élevée) |
| LTV filleul moyen | ~3 ans × 49€/mois = ~1 760€ |
| Coût remise parrain (exemple -10€/mois × 36 mois) | -360€ par filleul |
| Marge nette sur filleul parrainé | ~1 400€ vs CAC classique |

La rentabilité dépend du LTV filleul. Si churn élevé la première année, le programme est déficitaire.

---

## Questions stratégiques à creuser

**1 — Canal vs programme**
Le parrainage est-il plus efficace que le canal institutionnel LMDJ pour l'acquisition de masse ? Probablement complémentaire : LMDJ = volume institutionnel, parrainage = conviction pair-à-pair dans les réseaux informels (groupes Facebook hébergeurs, syndicats locaux, salons).

**2 — Yves Massard comme premier testeur naturel**
Yves est le seed idéal. 20 ans de réseau LMDJ, déjà convaincu. Un lien de parrainage lui donne une incitation financière à en parler à ses pairs. Proposer dès que Stripe est opérationnel.

**3 — Risque de cannibalisation LMDJ**
Si des hébergeurs s'inscrivent via parrainage, ils court-circuitent le canal institutionnel. Est-ce un problème avec Anaïtis ? À anticiper dans la conversation partenariale.

**4 — Implémentation technique**
- Champ `parrainId` sur `CentreHebergement` ou `User`
- Suivi remise : crédit mensuel Stripe ou discount récurrent
- Dashboard parrain : nb filleuls actifs, économies cumulées
- Effort estimé : 2-3j backend + 1j frontend
- Bloquant : Stripe Checkout doit être en place d'abord

**5 — Timing**
Ne pas lancer avant que Stripe Checkout soit opérationnel (objectif nov 2026). Le parrainage sans paiement en ligne automatisé est ingérable manuellement.

---

## Prochaines étapes

- [ ] Valider l'intérêt avec Yves lors du prochain échange (lui proposer comme beta testeur)
- [ ] Modéliser l'économique sur 3 scénarios (5%, 15%, 30% de taux de parrainage actif)
- [ ] Décider de la mécanique : % temporaire vs remise fixe permanente
- [ ] Prioriser après Stripe Checkout (nov 2026)
