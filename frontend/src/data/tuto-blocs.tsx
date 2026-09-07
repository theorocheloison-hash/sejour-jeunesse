// Contenu des fiches « Tutoriel » de l'espace organisateur (Lot 1 onboarding).
// Une fiche par écran (clé = onglet, ou sous-vue pour Réservation) ; le composant
// TutoBloc.tsx choisit la fiche depuis l'onglet actif. Données pures, aucun état.

import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  FolderOpen,
  GraduationCap,
  MessageCircle,
  Newspaper,
  UsersRound,
  Users,
  Wallet,
} from 'lucide-react';

export interface FicheTuto {
  icon: LucideIcon;
  titre: string;
  /** Ligne de contexte optionnelle affichée avant les sections. */
  accroche?: string;
  aQuoi: string;
  actions: string;
  comment: string;
  bonASavoir: string;
}

export const FICHES_TUTO: Record<string, FicheTuto> = {
  devis: {
    icon: FileSignature,
    titre: 'Devis — le cœur de votre réservation',
    aQuoi: "Consulter le devis préparé par l'hébergeur et le signer pour confirmer le séjour.",
    actions: "Lire le devis (et le contrat), le signer en ligne, l'envoyer à votre direction pour signature, ou déposer un scan signé.",
    comment: "Ouvrez le devis (téléchargez le contrat s'il est fourni — la case d'acceptation ne se débloque qu'une fois le contrat ouvert), puis choisissez : signer en ligne (votre nom et prénom suffisent), envoyer à la direction (saisissez son email, elle reçoit un lien pour signer), ou déposer le PDF signé à la main.",
    bonASavoir: "Tant que le devis n'est pas signé, votre séjour reste une option. Une fois signé, il est confirmé — et de nouvelles possibilités s'ouvrent (accompagnateurs, prix par élève, documents officiels). La signature en ligne est sécurisée (IP et date enregistrées).",
  },
  'documents-officiels': {
    icon: ClipboardCheck,
    titre: 'Documents officiels — votre dossier administratif',
    accroche: 'Apparaît une fois le devis signé.',
    aQuoi: "Suivre l'avancement de votre dossier et le transmettre à votre direction.",
    actions: 'Voir la checklist de ce qui est prêt ou manquant, suivre et valider les paiements des familles, générer vos PDF, envoyer le dossier au directeur.',
    comment: "La checklist (convention, autorisations, programme, projet pédagogique, budget…) se coche automatiquement à mesure que vous avancez ; les cartes « Documents à générer » vous emmènent au bon endroit ; « Envoyer au directeur » lui transmet le dossier par email avec un lien.",
    bonASavoir: "La ligne « Convention de transport » est à cocher vous-même une fois le document déposé. Le pourcentage n'est qu'un indicateur, il ne bloque rien.",
  },
  projet: {
    icon: GraduationCap,
    titre: 'Projet pédagogique — le sens de votre séjour',
    aQuoi: 'Formaliser le projet (objectifs, lien avec les programmes) et générer un PDF pour votre hiérarchie.',
    actions: 'Renseigner vos objectifs pédagogiques et le lien avec les programmes, puis exporter le projet en PDF (et la préparation TAM pour un séjour hors-scolaire).',
    comment: "Remplissez les champs libres ; les informations du séjour (établissement, dates, élèves, planning, thématiques) se remplissent toutes seules à partir du reste de votre dossier. Cliquez sur « Projet pédagogique PDF » pour l'exporter.",
    bonASavoir: 'Optionnel — à remplir si votre établissement le demande. Les thématiques que vous choisissez alimentent aussi la checklist des documents officiels.',
  },
  budget: {
    icon: Wallet,
    titre: 'Budget prévisionnel — vos comptes au clair',
    aQuoi: "Voir ce que coûte l'hébergement, ajouter vos autres dépenses et vos recettes, suivre votre solde, et fixer le prix par élève.",
    actions: "Ajouter/supprimer des dépenses complémentaires (transport, assurance, activités…) et des recettes (participation des familles, subventions, FSE/MDL…), définir le prix par élève et la date limite d'inscription, exporter un PDF.",
    comment: "Les prestations de l'hébergeur viennent du devis (vous ne les modifiez pas ici) ; ajoutez vos lignes et vos recettes, le solde se recalcule tout seul. Le prix par élève est proposé automatiquement (montant du devis ÷ nombre d'élèves) et reste ajustable.",
    bonASavoir: "Optionnel mais bien pratique. Le prix par élève ne s'enregistre (et n'active le paiement en ligne des familles) qu'après signature du devis — avant, il reste indicatif.",
  },
  participants: {
    icon: Users,
    titre: 'Participants — votre responsabilité principale',
    aQuoi: "Gérer la liste de vos élèves et de vos accompagnateurs. C'est vous qui en avez la charge.",
    actions: "Choisir votre méthode d'inscription, ajouter vos élèves, suivre signatures et paiements, ajouter vos accompagnateurs, exporter la liste, clôturer les inscriptions.",
    comment: "Choisissez en haut votre méthode. « Je fais remplir par les familles » : ajoutez vos élèves (à la main ou par import CSV), puis sélectionnez-les et envoyez aux parents le lien d'autorisation (ils signent et paient en ligne) ; vous suivez l'avancement des signatures. « Je saisis moi-même la liste » : remplissez directement la grille (vous gérez les autorisations papier de votre côté). Ajoutez ensuite vos accompagnateurs (possible une fois le devis signé) : chacun reçoit un ordre de mission, et vous pouvez lui donner un accès à l'espace. Quand votre liste est complète, clôturez les inscriptions — c'est ce qui débloque les groupes et les chambres.",
    bonASavoir: "Les deux méthodes restent accessibles à tout moment. Un export CSV est disponible. Les accompagnateurs ne s'ajoutent qu'après signature du devis.",
  },
  groupes: {
    icon: UsersRound,
    titre: 'Groupes — répartissez vos élèves',
    aQuoi: 'Organiser vos élèves inscrits en groupes, pour les activités et le planning.',
    actions: "Glisser chaque élève dans un groupe, l'en retirer.",
    comment: "Les groupes sont créés par l'hébergeur — si vous n'en voyez aucun, demandez-lui lesquels il prévoit. Clôturez d'abord vos inscriptions (bandeau orange en haut) : sans ça, la liste de vos élèves à répartir n'apparaît pas. Puis glissez chaque élève de la colonne de gauche vers le bon groupe.",
    bonASavoir: 'La taille des groupes est indicative. Un ✓ signale les autorisations déjà signées. Cliquez sur le × pour retirer un élève.',
  },
  planning: {
    icon: CalendarDays,
    titre: 'Planning — le déroulé du séjour',
    aQuoi: 'Consulter le programme, jour par jour, heure par heure.',
    actions: 'Consulter le programme en détail, et le télécharger en PDF.',
    comment: "Le programme est construit par l'hébergeur ; vous le retrouvez ici, organisé par journée, avec les groupes concernés par chaque activité.",
    bonASavoir: "Vous êtes en lecture seule sur cet onglet — pour un ajustement, passez par les Messages. Le bouton PDF apparaît dès qu'une activité est planifiée.",
  },
  chambres: {
    icon: BedDouble,
    titre: 'Chambres — placez vos participants',
    aQuoi: "Répartir vos élèves et accompagnateurs dans les chambres attribuées par l'hébergeur, puis imprimer le plan.",
    actions: "Placer chaque participant dans une chambre, basculer entre « Édition » et « Plan », télécharger le plan en PDF.",
    comment: "L'hébergeur vous attribue d'abord des chambres — si l'écran indique « Votre hébergeur doit d'abord vous affecter des chambres », demandez-lui lesquelles sont réservées à votre groupe. Clôturez vos inscriptions : le placement (vue « Édition ») n'est possible qu'après. Puis glissez chaque participant dans une chambre.",
    bonASavoir: "Une chambre pleine refuse un participant de plus (capacité fixée par l'hébergeur). La vue « Plan » (qui dort où) reste consultable à tout moment, même avant clôture.",
  },
  messages: {
    icon: MessageCircle,
    titre: "Messages — votre ligne directe avec l'hébergeur",
    aQuoi: "Échanger avec l'hébergeur (et votre direction si elle participe) au même endroit, fini les mails éparpillés.",
    actions: 'Écrire un message, suivre la conversation en temps réel.',
    comment: "Tapez votre message en bas, Entrée pour envoyer. La conversation s'actualise seule ; chaque bulle indique qui parle (Organisateur, Hébergeur, Direction).",
    bonASavoir: "Tout l'historique reste ici, accessible à tout moment.",
  },
  journal: {
    icon: Newspaper,
    titre: 'Journal — faites vivre le séjour',
    aQuoi: "Partager nouvelles et photos du séjour — l'équivalent d'un petit blog, à la place d'un groupe WhatsApp.",
    actions: 'Publier des messages et des photos, envoyer aux familles un lien pour suivre le séjour.',
    comment: "Rédigez un post (texte + photos) ; envoyez aux familles le lien de suivi (chaque famille dont vous avez l'email reçoit son propre lien sécurisé).",
    bonASavoir: "L'hébergeur peut aussi publier ici. Les familles n'ont qu'un accès en lecture.",
  },
  'documents-partages': {
    icon: FolderOpen,
    titre: 'Documents partagés — vos fichiers communs',
    aQuoi: "Centraliser les fichiers utiles au séjour, partagés avec l'hébergeur.",
    actions: 'Consulter et télécharger les documents mis à disposition par le centre, déposer vos propres fichiers.',
    comment: "Glissez un fichier ou cliquez pour l'ajouter, donnez-lui un nom et un type (programme, transport, assurance, facture…). Il devient visible par l'hébergeur.",
    bonASavoir: "Formats acceptés : PDF, Word, Excel, PowerPoint, images. Les documents du centre partenaire apparaissent en haut de l'onglet.",
  },
};
