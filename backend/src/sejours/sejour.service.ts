import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, StatutSejour, AppelOffreStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

@Injectable()
export class SejourService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateSejourDto, createurId: string) {
    return this.prisma.sejour.create({
      data: {
        titre:                    dto.titre,
        description:              dto.informationsComplementaires,
        lieu:                     dto.zoneGeographique,
        dateDebut:                new Date(dto.dateDebut),
        dateFin:                  new Date(dto.dateFin),
        placesTotales:            dto.nombreEleves,
        placesRestantes:          dto.nombreEleves,
        niveauClasse:             dto.niveauClasse,
        thematiquesPedagogiques:  dto.thematiquesPedagogiques,
        regionSouhaitee:          `${dto.typeZone}:${dto.zoneGeographique}`,
        dateButoireDevis:         dto.dateButoireDevis ? new Date(dto.dateButoireDevis) : null,
        createurId,
      },
    });
  }

  async getMesSejours(createurId: string) {
    return this.prisma.sejour.findMany({
      where:   { createurId },
      include: {
        demandes: {
          include: {
            _count: { select: { devis: true } },
            devis: {
              where: { statut: 'SELECTIONNE' },
              select: {
                id: true,
                statut: true,
                montantTotal: true,
                montantTTC: true,
                typeDocument: true,
                estFacture: true,
                numeroFacture: true,
                montantAcompte: true,
                pourcentageAcompte: true,
                centre: { select: { nom: true } },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.sejour.findMany({
      include: {
        createur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getDossierPedagogique(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: { select: { prenom: true, nom: true, email: true, telephone: true } },
        hebergementSelectionne: { select: { nom: true, ville: true, adresse: true, telephone: true } },
        autorisations: {
          select: { eleveNom: true, elevePrenom: true, parentEmail: true, signeeAt: true },
          orderBy: { eleveNom: 'asc' },
        },
        _count: { select: { inscriptions: true, autorisations: true } },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');

    // TEACHER can only see their own
    if (user.role === Role.TEACHER && sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return sejour;
  }

  async getAccompagnateurs(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    // Return the teacher (createur) as default accompagnateur
    const createur = await this.prisma.user.findUnique({
      where: { id: sejour.createurId! },
      select: { id: true, prenom: true, nom: true, email: true, telephone: true },
    });

    return { accompagnateurs: createur ? [createur] : [] };
  }

  async updateStatus(id: string, statut: StatutSejour, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');

    if (user.role === Role.TEACHER) {
      if (sejour.createurId !== user.id)
        throw new ForbiddenException('Ce séjour ne vous appartient pas');
      if (statut !== StatutSejour.SUBMITTED)
        throw new ForbiddenException('Les enseignants peuvent uniquement soumettre un séjour');
    }

    const updated = await this.prisma.sejour.update({
      where: { id },
      data:  { statut },
    });

    // Notifier l'enseignant quand le séjour est approuvé
    if (statut === StatutSejour.APPROVED && sejour.createurId) {
      const enseignant = await this.prisma.user.findUnique({
        where: { id: sejour.createurId },
        select: { email: true, prenom: true, nom: true },
      });
      if (enseignant) {
        await this.email.sendSejourApprouve(
          enseignant.email,
          `${enseignant.prenom} ${enseignant.nom}`,
          sejour.titre,
        );
      }
    }

    // Auto-create DemandeDevis when a sejour is SUBMITTED
    if (statut === StatutSejour.SUBMITTED && sejour.createurId) {
      const thematiques = sejour.thematiquesPedagogiques ?? [];
      const descParts = [
        sejour.description ?? '',
        sejour.niveauClasse ? `Niveau : ${sejour.niveauClasse}` : '',
        thematiques.length > 0 ? `Thématiques : ${thematiques.join(', ')}` : '',
      ].filter(Boolean);

      await this.prisma.demandeDevis.create({
        data: {
          sejourId:           sejour.id,
          titre:              sejour.titre,
          description:        descParts.join('\n'),
          dateDebut:          sejour.dateDebut,
          dateFin:            sejour.dateFin,
          nombreEleves:       sejour.placesTotales,
          villeHebergement:   sejour.lieu,
          regionCible:        sejour.regionSouhaitee ?? '',
          dateButoireReponse: sejour.dateButoireDevis,
          enseignantId:       sejour.createurId,
        },
      });

      await this.prisma.sejour.update({
        where: { id },
        data:  { appelOffreStatut: AppelOffreStatut.OUVERT },
      });

      // Notifier les hébergeurs de la nouvelle demande
      const dateDebut = sejour.dateDebut.toLocaleDateString('fr-FR');
      const dateFin = sejour.dateFin.toLocaleDateString('fr-FR');
      // TODO: ABONNEMENT — réactiver le filtre par abonnement actif
      const centres = await this.prisma.centreHebergement.findMany({
        include: { user: { select: { email: true } } },
      });
      for (const centre of centres) {
        await this.email.sendNouvelleDemandeDevis(
          centre.user.email,
          centre.nom,
          sejour.titre,
          sejour.lieu ?? '',
          dateDebut,
          dateFin,
        );
      }
    }

    return updated;
  }
}
