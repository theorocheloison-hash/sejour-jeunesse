import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        telephone: true,
        role: true,
        emailRectorat: true,
        onboardingTourEtape: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const orgaPrincipale = await getOrganisationPrincipale(userId, this.prisma);

    return {
      ...user,
      organisation: orgaPrincipale
        ? {
            id:            orgaPrincipale.id,
            nom:           orgaPrincipale.nom,
            uai:           orgaPrincipale.uai ?? null,
            siren:         orgaPrincipale.siren ?? null,
            typeStructure: orgaPrincipale.typeStructure ?? null,
            ville:         orgaPrincipale.ville ?? null,
          }
        : null,
    };
  }

  async updateProfil(userId: string, data: { emailRectorat?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailRectorat: data.emailRectorat ?? null },
      select: {
        id: true,
        emailRectorat: true,
      },
    });
  }

  async setOnboardingTourEtape(userId: string, etape: number) {
    // Borne basse à l'existant : la progression du tour ne régresse jamais
    // (un vieux client qui renvoie une étape déjà passée ne l'écrase pas).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingTourEtape: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (etape <= user.onboardingTourEtape) {
      return { onboardingTourEtape: user.onboardingTourEtape };
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingTourEtape: etape },
      select: { onboardingTourEtape: true },
    });
  }

}
