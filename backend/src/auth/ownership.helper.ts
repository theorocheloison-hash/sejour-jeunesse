import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * R1 — « ce SIGNATAIRE est lié à ce SÉJOUR »
 * Trois sources (S1 ∪ S2 ∪ S3), identiques à getAllSejoursSignataire.
 * Résout email + orgIds du signataire en interne (1 query).
 */
export async function isSignataireLinkedToSejour(
  prisma: PrismaService,
  signataireUserId: string,
  sejourId: string,
): Promise<boolean> {
  const signataire = await prisma.user.findUnique({
    where: { id: signataireUserId },
    select: {
      email: true,
      memberships: {
        where: { isPrimary: true },
        select: { organisationId: true },
      },
    },
  });
  if (!signataire) return false;

  const orgIds = signataire.memberships.map((m) => m.organisationId);

  const sejour = await prisma.sejour.findUnique({
    where: { id: sejourId },
    select: { createurId: true, modeGestion: true, clientOrganisationId: true },
  });
  if (!sejour) return false;

  // S1 — collègues d'organisation primaire
  if (sejour.createurId && orgIds.length > 0) {
    const collegues = await prisma.membership.findMany({
      where: { organisationId: { in: orgIds } },
      select: { userId: true },
    });
    if (collegues.some((c) => c.userId === sejour.createurId)) return true;
  }

  // S2 — invitation directeur par email
  if (signataire.email) {
    const invitation = await prisma.invitationDirecteur.findFirst({
      where: { emailDirecteur: signataire.email, sejourId },
      select: { id: true },
    });
    if (invitation) return true;
  }

  // S3 — séjour DIRECT dont le client est rattaché à une org du signataire
  if (
    sejour.modeGestion === 'DIRECT' &&
    sejour.clientOrganisationId &&
    orgIds.includes(sejour.clientOrganisationId)
  ) {
    return true;
  }

  return false;
}

/** Assert version — throw 403 si pas lié. */
export async function assertSignataireCanAccessSejour(
  prisma: PrismaService,
  user: { id: string },
  sejourId: string,
): Promise<void> {
  const linked = await isSignataireLinkedToSejour(prisma, user.id, sejourId);
  if (!linked) throw new ForbiddenException('Vous n\'avez pas accès à ce séjour');
}

/** R2 — SIGNATAIRE lié à une demande = R1 sur demande.sejourId. */
export async function assertSignataireCanAccessDemande(
  prisma: PrismaService,
  user: { id: string },
  demandeId: string,
): Promise<void> {
  const demande = await prisma.demandeDevis.findUnique({
    where: { id: demandeId },
    select: { sejourId: true },
  });
  if (!demande) throw new ForbiddenException('Demande introuvable');
  await assertSignataireCanAccessSejour(prisma, user, demande.sejourId);
}

/**
 * R3 — HEBERGEUR (centre) lié à une demande.
 * H1: centreDestinataireId == centreId
 * H2: un devis de ce centre existe
 * H3: demande OUVERTE sans destinataire (browse-to-quote, la zone a été filtrée en liste)
 */
export async function assertHebergeurCanAccessDemande(
  prisma: PrismaService,
  centreId: string,
  demandeId: string,
): Promise<void> {
  const demande = await prisma.demandeDevis.findUnique({
    where: { id: demandeId },
    select: { centreDestinataireId: true, statut: true },
  });
  if (!demande) throw new ForbiddenException('Demande introuvable');
  if (demande.centreDestinataireId === centreId) return;
  const devisExistant = await prisma.devis.findFirst({
    where: { demandeId, centreId },
    select: { id: true },
  });
  if (devisExistant) return;
  if (demande.statut === 'OUVERTE' && !demande.centreDestinataireId) return;
  throw new ForbiddenException('Vous n\'avez pas accès à cette demande');
}

/**
 * Retourne TOUS les sejourIds accessibles par un signataire (S1∪S2∪S3).
 * Utilisé pour scoper les listes (devis à valider, factures acompte).
 */
export async function getSignataireSejourIds(
  prisma: PrismaService,
  signataireUserId: string,
): Promise<string[]> {
  const signataire = await prisma.user.findUnique({
    where: { id: signataireUserId },
    select: {
      email: true,
      memberships: { where: { isPrimary: true }, select: { organisationId: true } },
    },
  });
  if (!signataire) return [];
  const orgIds = signataire.memberships.map((m) => m.organisationId);

  // S1 — séjours des collègues d'organisation
  const collegueIds = orgIds.length > 0
    ? [...new Set(
        (await prisma.membership.findMany({
          where: { organisationId: { in: orgIds } },
          select: { userId: true },
        })).map((m) => m.userId),
      )]
    : [];
  const sejoursCollegues = collegueIds.length > 0
    ? (await prisma.sejour.findMany({
        where: { createurId: { in: collegueIds }, deletedAt: null },
        select: { id: true },
      })).map((s) => s.id)
    : [];

  // S2 — invitations directeur par email
  const sejourIdsInvitation = signataire.email
    ? (await prisma.invitationDirecteur.findMany({
        where: { emailDirecteur: signataire.email },
        select: { sejourId: true },
      })).map((i) => i.sejourId)
    : [];

  // S3 — séjours DIRECT de l'organisation cliente
  const sejourIdsDirectOrg = orgIds.length > 0
    ? (await prisma.sejour.findMany({
        where: { clientOrganisationId: { in: orgIds }, modeGestion: 'DIRECT', deletedAt: null },
        select: { id: true },
      })).map((s) => s.id)
    : [];

  return [...new Set([...sejoursCollegues, ...sejourIdsInvitation, ...sejourIdsDirectOrg])];
}
