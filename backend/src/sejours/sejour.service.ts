import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, StatutSejour, AppelOffreStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import { UpdateSejourDto } from './dto/update-sejour.dto.js';
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

  async creerDepuisCatalogue(dto: {
    centreId: string;
    titre: string;
    dateDebut: string;
    dateFin: string;
    nombreEleves: number;
    message?: string;
  }, enseignantId: string) {
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: dto.centreId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.statut !== 'ACTIVE') throw new ForbiddenException('Ce centre n\'est pas disponible');

    const result = await this.prisma.$transaction(async (tx) => {
      const sejour = await tx.sejour.create({
        data: {
          titre: dto.titre,
          lieu: centre.ville,
          dateDebut: new Date(dto.dateDebut),
          dateFin: new Date(dto.dateFin),
          placesTotales: dto.nombreEleves,
          placesRestantes: dto.nombreEleves,
          statut: 'CONVENTION',
          createurId: enseignantId,
          hebergementSelectionneId: centre.id,
          regionSouhaitee: `VILLE:${centre.ville}`,
        },
      });

      await tx.demandeDevis.create({
        data: {
          sejourId: sejour.id,
          enseignantId,
          titre: dto.titre,
          dateDebut: new Date(dto.dateDebut),
          dateFin: new Date(dto.dateFin),
          nombreEleves: dto.nombreEleves,
          villeHebergement: centre.ville,
          statut: 'OUVERTE',
        },
      });

      return { sejourId: sejour.id };
    });

    // Notifier l'hébergeur
    const centreUser = await this.prisma.user.findFirst({
      where: { centres: { some: { id: dto.centreId } } },
      select: { email: true, prenom: true },
    });
    if (centreUser) {
      const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
      const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
      const lien = `https://precious-comfort-production-52c6.up.railway.app/dashboard/sejour/${result.sejourId}`;
      await this.email.sendGenericNotification(
        centreUser.email,
        `Nouvelle demande de séjour — ${dto.titre}`,
        `<p>Un enseignant souhaite organiser un séjour avec votre centre.</p>
         <p><strong>Séjour :</strong> ${dto.titre}<br>
         <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Nombre d'élèves :</strong> ${dto.nombreEleves}</p>
         ${dto.message ? `<p style="padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>` : ''}
         <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à l'espace collaboratif</a></p>`,
      );
    }

    return result;
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

  async findByEtablissement(etablissementUai: string) {
    return this.prisma.sejour.findMany({
      where: {
        createur: {
          etablissementUai: etablissementUai,
        },
      },
      include: {
        createur: {
          select: {
            prenom: true,
            nom: true,
            etablissementNom: true,
          },
        },
        demandes: {
          include: {
            devis: {
              include: { lignes: true },
            },
          },
        },
        hebergementSelectionne: {
          select: { nom: true },
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getSejourDetail(id: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementUai: true,
            etablissementEmail: true, etablissementTelephone: true,
          },
        },
        accompagnateurs: {
          select: {
            id: true, prenom: true, nom: true, email: true,
            telephone: true, signeeAt: true, signatureNom: true,
            moyenTransport: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        autorisations: {
          select: {
            id: true, elevePrenom: true, eleveNom: true,
            parentEmail: true, signeeAt: true,
          },
          orderBy: { eleveNom: 'asc' },
        },
        demandes: {
          include: {
            devis: {
              include: {
                lignes: true,
                centre: { select: { id: true, nom: true, ville: true, email: true, telephone: true } },
              },
            },
          },
        },
        hebergements: { select: { nom: true, adresse: true, ville: true }, take: 1 },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    return sejour;
  }

  async getDossierPedagogique(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementUai: true,
            etablissementEmail: true, etablissementTelephone: true,
          },
        },
        hebergementSelectionne: { select: { nom: true, ville: true, adresse: true, telephone: true } },
        accompagnateurs: {
          select: {
            id: true, prenom: true, nom: true, email: true,
            telephone: true, signeeAt: true, moyenTransport: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        planningActivites: {
          orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
        },
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

  async update(id: string, dto: UpdateSejourDto, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: { createur: { select: { etablissementNom: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const data: Record<string, unknown> = {};
    if (dto.prix !== undefined) data.prix = dto.prix;
    if (dto.dateLimiteInscription !== undefined)
      data.dateLimiteInscription = new Date(dto.dateLimiteInscription);

    const updated = await this.prisma.sejour.update({ where: { id }, data });

    // Envoyer un email aux parents quand le prix est défini
    if (dto.prix !== undefined && dto.prix > 0) {
      const autorisations = await this.prisma.autorisationParentale.findMany({
        where: { sejourId: id },
        select: { parentEmail: true, elevePrenom: true, eleveNom: true, tokenAcces: true },
      });

      const etablissement = sejour.createur?.etablissementNom ?? 'L\'établissement scolaire';
      const prixFormate = dto.prix.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

      for (const aut of autorisations) {
        const lien = `https://precious-comfort-production-52c6.up.railway.app/autorisation/${aut.tokenAcces}`;
        await this.email.sendPaiementDisponible(
          aut.parentEmail,
          sejour.titre,
          etablissement,
          prixFormate,
          aut.elevePrenom,
          aut.eleveNom,
          lien,
        );
      }
    }

    return updated;
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

      // Auto-approve : le séjour passe directement en APPROVED sans validation directeur
      await this.prisma.sejour.update({
        where: { id },
        data:  { statut: StatutSejour.APPROVED },
      });
    }

    return updated;
  }
}
