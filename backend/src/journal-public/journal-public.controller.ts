import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('journal-public')
export class JournalPublicController {
  constructor(private prisma: PrismaService) {}

  /** GET /journal-public/:token — Accès parent au journal via token autorisation */
  @Get(':token')
  async getJournalByToken(@Param('token') token: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
      select: {
        id: true,
        tokenExpiresAt: true,
        elevePrenom: true,
        eleveNom: true,
        sejour: {
          select: {
            id: true,
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            description: true,
            niveauClasse: true,
            placesTotales: true,
            hebergements: {
              select: { nom: true, ville: true, adresse: true, telephone: true },
              take: 1,
            },
            postsJournal: {
              orderBy: { createdAt: 'desc' },
              include: {
                auteur: { select: { prenom: true, nom: true, role: true } },
                photos: { orderBy: { ordre: 'asc' } },
              },
            },
            planningActivites: {
              orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
              select: {
                id: true,
                date: true,
                heureDebut: true,
                heureFin: true,
                titre: true,
                couleur: true,
                estCollective: true,
                // §4.18 : groupes structurés (refonte m2m 07/07) — le front ne peut
                // plus les déduire du titre (plus de suffixe « — G1 »).
                groupes: {
                  select: { groupe: { select: { id: true, nom: true, couleur: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!autorisation) throw new NotFoundException('Lien invalide ou expiré');
    if (autorisation.tokenExpiresAt && autorisation.tokenExpiresAt < new Date()) {
      throw new NotFoundException('Lien invalide ou expiré');
    }

    // Aplatissement de la jointure : groupes = [{id, nom, couleur}] — même contrat
    // que le planning authentifié (collaboration.service).
    const { sejour } = autorisation;
    return {
      ...autorisation,
      sejour: sejour
        ? {
            ...sejour,
            planningActivites: sejour.planningActivites.map(({ groupes, ...activite }) => ({
              ...activite,
              groupes: groupes.map((g) => g.groupe),
            })),
          }
        : sejour,
    };
  }
}
