/**
 * Résolveur canonique de l'identité + contact « client » d'un séjour (frontend).
 *
 * Sémantique E2 du chantier Étape 4 (`docs/CHANTIER_ETAPE4_CLIENT_HEBERGEUR.md`, §1/§2/§4bis) :
 * **override hébergeur au niveau du séjour** — `sejour.client*` fait foi dès qu'il est posé.
 * Le compte enseignant (`prenom/nom/email/telephone`, `memberships[0].organisation`) n'est PAS
 * une source vivante de l'identité : c'est le login + le canal de notification applicative. Il ne
 * sert donc qu'en FALLBACK legacy COLLAB quand le séjour ne porte pas encore l'information.
 *
 * Cette fonction est PURE (aucune dépendance hors TypeScript) et sans libellé par défaut : les
 * défauts d'affichage (« Établissement scolaire »…) restent à la charge des consommateurs.
 *
 * Ordre de résolution :
 *  - établissement : `sejour.clientOrganisation` puis membership (créateur d'abord, aligné sur
 *    `DevisCard.resolveEtablissement`) ;
 *  - contact : champs `sejour.client*` puis compte enseignant, puis compte créateur.
 *
 * ⚠️ Ce module est le canonique du Lot 1. La bascule des lecteurs vers lui est le Lot 2.
 */

export interface SejourClientFields {
  clientNom?: string | null;
  clientPrenom?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  clientOrganisation?: string | null;
  clientAdresse?: string | null;
  clientCodePostal?: string | null;
  clientVille?: string | null;
}

export interface PersonneContact {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  telephone?: string | null;
  memberships?: Array<{ organisation: { nom: string | null; ville?: string | null; uai?: string | null } }>;
}

export interface ClientEtablissementResolu {
  nom: string | null;
  ville: string | null;
  adresse: string | null;
  codePostal: string | null;
  uai: string | null;
  contactNom: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  source: 'SEJOUR' | 'MEMBERSHIP' | null;
}

export function resolveClientEtablissement(
  sejour?: SejourClientFields | null,
  opts?: { enseignant?: PersonneContact | null; createur?: PersonneContact | null },
): ClientEtablissementResolu {
  // Membership : créateur d'abord, sinon enseignant (ordre aligné sur DevisCard.resolveEtablissement).
  const org =
    opts?.createur?.memberships?.[0]?.organisation ?? opts?.enseignant?.memberships?.[0]?.organisation;

  const nom = sejour?.clientOrganisation || org?.nom || null;
  const source: 'SEJOUR' | 'MEMBERSHIP' | null = sejour?.clientOrganisation
    ? 'SEJOUR'
    : org?.nom
      ? 'MEMBERSHIP'
      : null;

  const ville = sejour?.clientVille || org?.ville || null;
  const adresse = sejour?.clientAdresse || null;
  const codePostal = sejour?.clientCodePostal || null;
  const uai = org?.uai || null; // le séjour ne porte pas d'UAI

  // Contact : le séjour prime ; sinon compte enseignant puis compte créateur.
  const pers = opts?.enseignant ?? opts?.createur;
  const contactNom =
    [sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' ') ||
    [pers?.prenom, pers?.nom].filter(Boolean).join(' ') ||
    null;
  const contactEmail =
    sejour?.clientEmail || opts?.enseignant?.email || opts?.createur?.email || null;
  const contactTelephone =
    sejour?.clientTelephone || opts?.enseignant?.telephone || opts?.createur?.telephone || null;

  return { nom, ville, adresse, codePostal, uai, contactNom, contactEmail, contactTelephone, source };
}
