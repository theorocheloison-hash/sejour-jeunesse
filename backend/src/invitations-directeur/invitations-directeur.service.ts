import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { OccupationsService } from '../chambres/occupations.service.js';

@Injectable()
export class InvitationsDirecteurService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private occupations: OccupationsService,
  ) {}

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationDirecteur.findUnique({
      where: { token },
      include: { organisation: { select: { id: true, nom: true, uai: true, ville: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable ou expirée');

    let devis: any = null;
    if (invitation.devisId) {
      devis = await this.prisma.devis.findUnique({
        where: { id: invitation.devisId },
        select: {
          id: true,
          montantTotal: true,
          montantTTC: true,
          montantHT: true,
          montantTVA: true,
          montantAcompte: true,
          pourcentageAcompte: true,
          numeroDevis: true,
          statut: true,
          signatureDirecteur: true,
          dateSignatureDirecteur: true,
          nomSignataireDirecteur: true,
          nomEntreprise: true,
          adresseEntreprise: true,
          siretEntreprise: true,
          emailEntreprise: true,
          telEntreprise: true,
          tauxTva: true,
          conditionsAnnulation: true,
          createdAt: true,
          lignes: true,
          centre: {
            select: {
              nom: true,
              ville: true,
              adresse: true,
              codePostal: true,
              siret: true,
              telephone: true,
              email: true,
              logoUrl: true,
            },
          },
          demande: {
            select: {
              enseignant: {
                select: {
                  prenom: true,
                  nom: true,
                  email: true,
                  telephone: true,
                  memberships: {
                    where: { isPrimary: true },
                    select: {
                      organisation: { select: { nom: true, ville: true, uai: true } },
                    },
                    take: 1,
                  },
                },
              },
              sejour: {
                select: {
                  titre: true,
                  lieu: true,
                  dateDebut: true,
                  dateFin: true,
                  placesTotales: true,
                  niveauClasse: true,
                },
              },
            },
          },
        },
      });
    }

    return {
      etablissementUai:  invitation.etablissementUai,
      etablissementNom:  invitation.etablissementNom,
      sejourTitre:       invitation.sejourTitre,
      enseignantPrenom:  invitation.enseignantPrenom,
      organisationId:    invitation.organisationId ?? null,
      typeContexte:      invitation.typeContexte ?? 'SCOLAIRE',
      organisation:      invitation.organisation ?? null,
      signeAt:           invitation.signeAt ?? null,
      nomSignataire:     invitation.nomSignataire ?? null,
      devis,
    };
  }

  async marquerUtilisee(token: string) {
    await this.prisma.invitationDirecteur.updateMany({
      where: { token, utilisedAt: null },
      data: { utilisedAt: new Date() },
    });
  }

  async creer(dto: {
    sejourId: string;
    devisId: string;
    emailDirecteur: string;
    enseignantPrenom: string;
    sejourTitre: string;
    etablissementUai?: string;
    etablissementNom?: string;
    organisationId?: string;
    typeContexte?: string;
  }, enseignantId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourId },
      select: { id: true, createurId: true, titre: true },
    });
    if (!sejour || sejour.createurId !== enseignantId) {
      throw new ForbiddenException('Accès refusé');
    }

    // Résoudre l'organisationId du créateur du séjour (pour le Membership signataire)
    let resolvedOrganisationId: string | null = dto.organisationId ?? null;
    if (!resolvedOrganisationId && sejour.createurId) {
      const membership = await this.prisma.membership.findFirst({
        where: { userId: sejour.createurId, isPrimary: true },
        select: { organisationId: true },
      });
      resolvedOrganisationId = membership?.organisationId ?? null;
    }

    const devis = await this.prisma.devis.findUnique({
      where: { id: dto.devisId },
      select: { id: true, statut: true },
    });
    if (!devis || devis.statut !== 'SELECTIONNE') {
      throw new ForbiddenException('Le devis doit être sélectionné pour envoyer une invitation');
    }

    const token = randomUUID();
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    await this.prisma.invitationDirecteur.create({
      data: {
        token,
        sejourId: dto.sejourId,
        devisId: dto.devisId,
        emailDirecteur: dto.emailDirecteur,
        enseignantPrenom: dto.enseignantPrenom,
        sejourTitre: dto.sejourTitre,
        etablissementUai: dto.etablissementUai ?? null,
        etablissementNom: dto.etablissementNom ?? null,
        organisationId: resolvedOrganisationId,
        typeContexte: dto.typeContexte ?? 'SCOLAIRE',
      },
    });

    const lienSignature = `${frontendUrl}/invitation-direction/${token}`;
    const lienCompte = `${frontendUrl}/register/signataire?token=${token}`;

    await this.email.sendGenericNotification(
      dto.emailDirecteur,
      `Demande de validation — ${dto.sejourTitre}`,
      `<p>Bonjour,</p>
       <p><strong>${dto.enseignantPrenom}</strong> vous soumet le devis pour le séjour <strong>« ${dto.sejourTitre} »</strong> pour validation et signature.</p>
       <p style="margin:24px 0">
         <a href="${lienSignature}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Consulter et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#888">
         Vous pouvez également
         <a href="${lienCompte}" style="color:#1B4060">créer un compte</a>
         pour accéder à votre espace de direction et consulter l'ensemble des séjours de votre établissement.
       </p>`,
    );

    return { success: true, token };
  }

  async signerSansCompte(token: string, dto: {
    nomSignataire: string;
    fonctionSignataire: string;
    ipAddress?: string;
  }) {
    const invitation = await this.prisma.invitationDirecteur.findUnique({
      where: { token },
      select: {
        id: true,
        devisId: true,
        sejourId: true,
        signeAt: true,
        emailDirecteur: true,
        sejourTitre: true,
        enseignantPrenom: true,
      },
    });

    if (!invitation) throw new NotFoundException('Invitation introuvable ou expirée');
    if (invitation.signeAt) throw new ForbiddenException('Cette invitation a déjà été signée');
    if (!invitation.devisId) throw new ForbiddenException('Devis introuvable pour cette invitation');

    await this.prisma.invitationDirecteur.update({
      where: { token },
      data: {
        nomSignataire: dto.nomSignataire,
        fonctionSignataire: dto.fonctionSignataire,
        signeAt: new Date(),
        signatureIp: dto.ipAddress ?? null,
        utilisedAt: new Date(),
      },
    });

    const nomComplet = `${dto.nomSignataire}${dto.fonctionSignataire ? ` (${dto.fonctionSignataire})` : ''}`;
    await this.prisma.devis.update({
      where: { id: invitation.devisId },
      data: {
        statut: 'SIGNE_DIRECTION',
        signatureDirecteur: `Signé électroniquement par ${nomComplet} — ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
        nomSignataireDirecteur: dto.nomSignataire,
        signatureIpAddress: dto.ipAddress ?? null,
        signatureHash: createHash('sha256')
          .update(`${invitation.devisId}${token}${new Date().toISOString()}`)
          .digest('hex'),
      },
    });

    await this.prisma.sejour.update({
      where: { id: invitation.sejourId },
      data: { statut: 'SIGNE_DIRECTION' },
    });

    // Sync occupations chambres (site 10 du §3.1, run-chambres-4a).
    await this.occupations.syncOccupationsSejourSafe(invitation.sejourId, 'invitationsDirecteur.signerSansCompte');

    const devis = await this.prisma.devis.findUnique({
      where: { id: invitation.devisId },
      include: {
        centre: { include: { user: { select: { email: true } } } },
        demande: { include: { sejour: { select: { titre: true } } } },
      },
    });

    if (devis?.centre?.user?.email) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
      await this.email.sendGenericNotification(
        devis.centre.user.email,
        `Devis signé par la direction — ${invitation.sejourTitre}`,
        `<p>Bonjour,</p>
         <p>Le devis pour le séjour <strong>« ${invitation.sejourTitre} »</strong> a été signé électroniquement.</p>
         <p><strong>Signataire :</strong> ${nomComplet}<br>
         <strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
         <p>Vous pouvez désormais émettre la facture d'acompte.</p>
         <p style="margin:24px 0">
           <a href="${frontendUrl}/dashboard/hebergeur/devis" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
             Accéder à mes devis
           </a>
         </p>`,
      );
    }

    return { success: true };
  }
}
