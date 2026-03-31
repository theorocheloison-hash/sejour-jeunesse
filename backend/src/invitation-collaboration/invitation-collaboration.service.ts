import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateInvitationCollaborationDto } from './dto/create-invitation.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

@Injectable()
export class InvitationCollaborationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateInvitationCollaborationDto, user: JwtUser) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId: user.id },
    });
    if (!centre) throw new ForbiddenException('Aucun centre associé à votre compte');

    const invitation = await this.prisma.invitationCollaboration.create({
      data: {
        centreId: centre.id,
        emailEnseignant: dto.emailEnseignant,
        titreSejourSuggere: dto.titreSejourSuggere,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nbElevesEstime: dto.nbElevesEstime,
        message: dto.message ?? null,
        niveauClasse: dto.niveauClasse ?? null,
        nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
        thematiquesPedagogiques: dto.thematiquesPedagogiques ?? [],
        heureArrivee: dto.heureArrivee ?? null,
        heureDepart: dto.heureDepart ?? null,
        transportAller: dto.transportAller ?? null,
        transportSurPlace: dto.transportSurPlace ?? null,
        activitesSouhaitees: dto.activitesSouhaitees ?? null,
        budgetMaxParEleve: dto.budgetMaxParEleve ?? null,
      },
    });

    const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
    const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/rejoindre/${invitation.token}`;

    const msgPart = dto.message
      ? `<p style="margin:12px 0;padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>`
      : '';

    await this.email.sendGenericNotification(
      dto.emailEnseignant,
      `${centre.nom} vous invite à collaborer sur un séjour`,
      `<p><strong>${centre.nom}</strong> souhaite organiser un séjour avec vous :</p>
       <p><strong>Séjour :</strong> ${dto.titreSejourSuggere}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Nombre d'élèves estimé :</strong> ${dto.nbElevesEstime}</p>
       ${msgPart}
       <p>Pour accepter cette invitation et démarrer la collaboration, cliquez sur le bouton ci-dessous.</p>
       <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accepter l'invitation</a></p>
       <p style="color:#888;font-size:12px">Vous n'avez pas encore de compte LIAVO ? Créez-en un gratuitement en cliquant sur le lien ci-dessus.</p>`,
    );

    return { id: invitation.id, token: invitation.token };
  }

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationCollaboration.findUnique({
      where: { token },
      include: {
        centre: {
          select: { nom: true, ville: true, adresse: true, userId: true },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Cette invitation a déjà été acceptée');
    return invitation;
  }

  async accepter(token: string, user: JwtUser) {
    const invitation = await this.prisma.invitationCollaboration.findUnique({
      where: { token },
      include: { centre: true },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Cette invitation a déjà été acceptée');

    const result = await this.prisma.$transaction(async (tx) => {
      // Séjour en DRAFT sans hébergeur lié — l'enseignant doit choisir via le workflow devis normal
      const sejour = await tx.sejour.create({
        data: {
          titre: invitation.titreSejourSuggere,
          lieu: invitation.centre.ville,
          dateDebut: invitation.dateDebut,
          dateFin: invitation.dateFin,
          placesTotales: invitation.nbElevesEstime,
          placesRestantes: invitation.nbElevesEstime,
          statut: 'DRAFT',
          createurId: user.id,
          // Pas de hebergementSelectionneId — l'hébergeur doit soumettre un devis
          regionSouhaitee: `VILLE:${invitation.centre.ville}`,
          niveauClasse: invitation.niveauClasse ?? null,
          thematiquesPedagogiques: invitation.thematiquesPedagogiques ?? [],
          nombreAccompagnateurs: invitation.nombreAccompagnateurs ?? null,
          heureArrivee: invitation.heureArrivee ?? null,
          heureDepart: invitation.heureDepart ?? null,
          transportAller: invitation.transportAller ?? null,
          transportSurPlace: invitation.transportSurPlace ?? null,
          activitesSouhaitees: invitation.activitesSouhaitees ?? null,
          budgetMaxParEleve: invitation.budgetMaxParEleve ?? null,
        },
      });

      // Demande de devis OUVERTE — visible dans les demandes reçues de l'hébergeur
      await tx.demandeDevis.create({
        data: {
          sejourId: sejour.id,
          enseignantId: user.id,
          titre: invitation.titreSejourSuggere,
          dateDebut: invitation.dateDebut,
          dateFin: invitation.dateFin,
          nombreEleves: invitation.nbElevesEstime,
          villeHebergement: invitation.centre.ville,
          statut: 'OUVERTE',
          centreDestinataireId: invitation.centreId,
          nombreAccompagnateurs: invitation.nombreAccompagnateurs ?? null,
          heureArrivee: invitation.heureArrivee ?? null,
          heureDepart: invitation.heureDepart ?? null,
          activitesSouhaitees: invitation.activitesSouhaitees ?? null,
          budgetMaxParEleve: invitation.budgetMaxParEleve ?? null,
          transportAller: invitation.transportAller ?? null,
          transportSurPlace: invitation.transportSurPlace ?? null,
        },
      });

      await tx.invitationCollaboration.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), sejourId: sejour.id },
      });

      return { sejourId: sejour.id };
    });

    // Notifier l'hébergeur qu'une demande l'attend
    const centreUser = await this.prisma.user.findUnique({
      where: { id: invitation.centre.userId! },
      select: { email: true },
    });
    if (centreUser) {
      const dateDebut = new Date(invitation.dateDebut).toLocaleDateString('fr-FR');
      const dateFin = new Date(invitation.dateFin).toLocaleDateString('fr-FR');
      await this.email.sendGenericNotification(
        centreUser.email,
        `L'enseignant a accepté votre invitation — demande de devis en attente`,
        `<p>L'enseignant que vous avez invité a accepté votre invitation pour le séjour <strong>${invitation.titreSejourSuggere}</strong>.</p>
         <p><strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Élèves :</strong> ${invitation.nbElevesEstime}</p>
         <p>Une demande de devis vous attend dans votre espace. Vous pouvez maintenant soumettre votre devis.</p>
         <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/venue/demandes" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mes demandes</a></p>`,
      );
    }

    return result;
  }

  async inviterCentreExterne(dto: {
    emailDestinataire: string;
    nomCentre: string;
    villeCentre: string;
    codePostalCentre: string;
    titreSejourSuggere: string;
    dateDebut: string;
    dateFin: string;
    nbElevesEstime: number;
    message?: string;
  }, enseignantId: string) {
    // Stocker l'invitation en DB
    const invitation = await this.prisma.invitationCentreExterne.create({
      data: {
        enseignantId,
        emailDestinataire: dto.emailDestinataire,
        nomCentre: dto.nomCentre,
        villeCentre: dto.villeCentre,
        codePostalCentre: dto.codePostalCentre,
        titreSejourSuggere: dto.titreSejourSuggere,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nbElevesEstime: dto.nbElevesEstime,
        message: dto.message ?? null,
      },
    });

    // Lien avec token pour relier l'inscription au retour
    const params = new URLSearchParams({
      nomCentre: dto.nomCentre,
      ville: dto.villeCentre,
      codePostal: dto.codePostalCentre,
      invitationToken: invitation.token,
    });
    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/venue?${params.toString()}`;

    const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
    const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
    const msgPart = dto.message
      ? `<p style="margin:12px 0;padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>`
      : '';

    await this.email.sendGenericNotification(
      dto.emailDestinataire,
      `Un enseignant souhaite collaborer avec ${dto.nomCentre} via LIAVO`,
      `<p>Un enseignant souhaite organiser un séjour avec votre structure :</p>
       <p><strong>Séjour :</strong> ${dto.titreSejourSuggere}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Nombre d'élèves :</strong> ${dto.nbElevesEstime}</p>
       ${msgPart}
       <p>Pour répondre à cette demande, créez votre compte gratuitement sur LIAVO. Vos informations seront pré-remplies automatiquement.</p>
       <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Créer mon compte LIAVO</a></p>
       <p style="color:#888;font-size:12px">Une fois votre compte validé par notre équipe, vous pourrez soumettre votre devis à cet enseignant.</p>`,
    );

    return { sent: true, token: invitation.token };
  }
}
