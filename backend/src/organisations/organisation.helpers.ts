import { PrismaService } from '../prisma/prisma.service.js';
import { SourceOrganisation, TypeStructure, RoleMembership, ClaimStatut, Organisation } from '@prisma/client';

/**
 * Trouve une Organisation existante ou en crée une nouvelle.
 * Déduplication par ordre de priorité :
 *   1. SIREN (si fourni et non-null)
 *   2. UAI (si fourni et non-null)
 *   3. nom + ville (fallback textuel)
 *
 * @returns L'Organisation trouvée ou créée
 */
export async function findOrCreateOrganisation(
  prisma: PrismaService,
  params: {
    siren?: string | null;
    siret?: string | null;
    uai?: string | null;
    rna?: string | null;
    nom: string;
    raisonSociale?: string | null;
    adresse?: string | null;
    codePostal?: string | null;
    ville?: string | null;
    departement?: string | null;
    emailContact?: string | null;
    telephoneContact?: string | null;
    siteWeb?: string | null;
    typeStructure?: TypeStructure | null;
    academie?: string | null;
    source: SourceOrganisation;
    sourceId?: string | null;
  },
): Promise<{ organisation: { id: string; nom: string; [key: string]: any }; created: boolean }> {
  // 1. Chercher par SIREN
  if (params.siren) {
    const existing = await prisma.organisation.findUnique({
      where: { siren: params.siren },
    });
    if (existing) return { organisation: existing, created: false };
  }

  // 2. Chercher par UAI
  if (params.uai) {
    const existing = await prisma.organisation.findFirst({
      where: { uai: params.uai },
    });
    if (existing) return { organisation: existing, created: false };
  }

  // 3. Chercher par nom + ville (fallback textuel, case-insensitive)
  if (params.nom && params.ville) {
    const existing = await prisma.organisation.findFirst({
      where: {
        nom: { equals: params.nom, mode: 'insensitive' },
        ville: { equals: params.ville, mode: 'insensitive' },
      },
    });
    if (existing) return { organisation: existing, created: false };
  }

  // 4. Créer
  const organisation = await prisma.organisation.create({
    data: {
      nom: params.nom,
      raisonSociale: params.raisonSociale ?? null,
      siren: params.siren ?? null,
      siret: params.siret ?? null,
      uai: params.uai ?? null,
      rna: params.rna ?? null,
      adresse: params.adresse ?? null,
      codePostal: params.codePostal ?? null,
      ville: params.ville ?? null,
      departement: params.departement ?? null,
      emailContact: params.emailContact ?? null,
      telephoneContact: params.telephoneContact ?? null,
      siteWeb: params.siteWeb ?? null,
      typeStructure: params.typeStructure ?? null,
      academie: params.academie ?? null,
      source: params.source,
      sourceId: params.sourceId ?? null,
    },
  });

  return { organisation, created: true };
}

/**
 * Crée une Membership pour un User vers une Organisation.
 * Idempotent : ne crée pas de doublon si la Membership existe déjà.
 *
 * @param claimStatut - NON_APPLICABLE pour les créations normales,
 *   EN_ATTENTE_DOCUMENT uniquement pour les claims HEBERGEUR sur orga existante avec centre
 */
export async function findOrCreateMembership(
  prisma: PrismaService,
  params: {
    userId: string;
    organisationId: string;
    role?: RoleMembership;
    isPrimary?: boolean;
    claimStatut?: ClaimStatut;
  },
): Promise<{ membership: { id: string; [key: string]: any }; created: boolean }> {
  const existing = await prisma.membership.findUnique({
    where: {
      userId_organisationId: {
        userId: params.userId,
        organisationId: params.organisationId,
      },
    },
  });
  if (existing) return { membership: existing, created: false };

  const membership = await prisma.membership.create({
    data: {
      userId: params.userId,
      organisationId: params.organisationId,
      role: params.role ?? 'PROPRIETAIRE',
      isPrimary: params.isPrimary ?? true,
      claimStatut: params.claimStatut ?? 'NON_APPLICABLE',
    },
  });

  return { membership, created: true };
}

/**
 * Retourne l'Organisation "principale" (isPrimary=true) d'un User.
 * Utilisé par les services backend pour résoudre l'organisation active
 * sans passer par les champs legacy etablissement* du User.
 *
 * Retourne null si le User n'a aucun Membership primary.
 * Ne lève pas d'exception — les appelants gèrent le cas null.
 *
 * @param userId  UUID du User
 * @param prisma  Instance PrismaService injectée par le service appelant
 */
export async function getOrganisationPrincipale(
  userId: string,
  prisma: PrismaService,
): Promise<Organisation | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      isPrimary: true,
    },
    include: {
      organisation: true,
    },
  });
  return membership?.organisation ?? null;
}

/**
 * Détermine si un claim Kbis est requis.
 * 4 conditions CUMULATIVES (doc ARCHITECTURE_ORGANISATIONS.md section 5.1) :
 *   1. Le User a le rôle HEBERGEUR
 *   2. L'Organisation existe en base
 *   3. L'Organisation a au moins un CentreHebergement rattaché
 *   4. Aucun Membership avec claimStatut=VALIDE n'existe sur cette Organisation
 *
 * Retourne false dans tous les autres cas (ORGANISATEUR, SIGNATAIRE, etc.)
 * Ne lève pas d'exception.
 */
export async function shouldRequireKbis(
  prisma: PrismaService,
  params: { userRole: string; organisationId: string },
): Promise<boolean> {
  if (params.userRole !== 'HEBERGEUR') return false;

  const org = await prisma.organisation.findUnique({
    where: { id: params.organisationId },
    include: {
      centresHebergement: { select: { id: true }, take: 1 },
      memberships: {
        where: { claimStatut: 'VALIDE' },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!org) return false;
  if (org.centresHebergement.length === 0) return false;
  if (org.memberships.length > 0) return false; // claim déjà validé

  return true;
}
