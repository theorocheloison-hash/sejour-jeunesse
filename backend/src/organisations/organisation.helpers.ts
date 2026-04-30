import { PrismaService } from '../prisma/prisma.service.js';
import { SourceOrganisation, TypeStructure, RoleMembership, ClaimStatut } from '@prisma/client';

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
 * Retourne l'Organisation primaire d'un User.
 * Centralise la logique qui remplace l'accès à user.etablissement*.
 */
export async function getOrganisationPrincipale(
  prisma: PrismaService,
  userId: string,
) {
  const membership = await prisma.membership.findFirst({
    where: { userId, isPrimary: true },
    include: { organisation: true },
  });
  return membership?.organisation ?? null;
}
