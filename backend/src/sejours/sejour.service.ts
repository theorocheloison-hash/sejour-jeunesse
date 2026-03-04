import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, StatutSejour, AppelOffreStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

@Injectable()
export class SejourService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSejourDto, createurId: string) {
    return this.prisma.sejour.create({
      data: {
        titre:                    dto.titre,
        description:              dto.informationsComplementaires,
        lieu:                     dto.villeHebergement,
        dateDebut:                new Date(dto.dateDebut),
        dateFin:                  new Date(dto.dateFin),
        placesTotales:            dto.nombreEleves,
        placesRestantes:          dto.nombreEleves,
        niveauClasse:             dto.niveauClasse,
        thematiquesPedagogiques:  dto.thematiquesPedagogiques,
        regionSouhaitee:          dto.regionSouhaitee,
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
          include: { _count: { select: { devis: true } } },
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
    }

    return updated;
  }
}
