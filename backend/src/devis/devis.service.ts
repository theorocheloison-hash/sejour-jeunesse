import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatutDevis, StatutSejour, AppelOffreStatut, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';

@Injectable()
export class DevisService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateDevisDto, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    // TODO: ABONNEMENT — réactiver la vérification d'abonnement

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: dto.demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'OUVERTE') {
      throw new ForbiddenException('Cette demande n\'est plus ouverte');
    }

    // Vérifier la date butoire
    if (demande.dateButoireReponse && demande.dateButoireReponse < new Date()) {
      throw new ForbiddenException('La date butoire de réponse est dépassée');
    }

    // Auto-generate numero devis if not provided
    const numeroDevis = dto.numeroDevis ?? await this.generateNumeroDevis(centre.id);

    const devis = await this.prisma.devis.create({
      data: {
        demandeId: dto.demandeId,
        centreId: centre.id,
        montantTotal: dto.montantTotal,
        montantParEleve: dto.montantParEleve,
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
        // Professional fields
        nomEntreprise: dto.nomEntreprise,
        adresseEntreprise: dto.adresseEntreprise,
        siretEntreprise: dto.siretEntreprise,
        emailEntreprise: dto.emailEntreprise,
        telEntreprise: dto.telEntreprise,
        tauxTva: dto.tauxTva,
        montantHT: dto.montantHT,
        montantTVA: dto.montantTVA,
        montantTTC: dto.montantTTC,
        pourcentageAcompte: dto.pourcentageAcompte,
        montantAcompte: dto.montantAcompte,
        numeroDevis,
        typeDevis: dto.typeDevis ?? 'PLATEFORME',
      },
    });

    // Create lignes if provided
    if (dto.lignes && dto.lignes.length > 0) {
      await this.prisma.ligneDevis.createMany({
        data: dto.lignes.map((l) => ({
          devisId: devis.id,
          description: l.description,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? 0,
          totalHT: l.totalHT,
          totalTTC: l.totalTTC,
        })),
      });
    }

    const fullDevis = await this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });

    // Notifier l'enseignant du nouveau devis
    const enseignant = await this.prisma.user.findUnique({
      where: { id: demande.enseignantId! },
      select: { email: true, prenom: true, nom: true },
    });
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: demande.sejourId },
      select: { titre: true },
    });
    if (enseignant && sejour) {
      await this.email.sendDevisRecu(
        enseignant.email,
        `${enseignant.prenom} ${enseignant.nom}`,
        sejour.titre,
        centre.nom,
        String(dto.montantTotal),
      );
    }

    return fullDevis;
  }

  async getMesDevis(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    return this.prisma.devis.findMany({
      where: { centreId: centre.id },
      include: {
        lignes: true,
        demande: {
          include: {
            enseignant: { select: { prenom: true, nom: true, email: true, telephone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDevisForDemande(demandeId: string, user: { id: string; role: string }) {
    if (user.role === 'TEACHER') {
      const demande = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
      });
      if (!demande || demande.enseignantId !== user.id) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        lignes: true,
        centre: { select: { id: true, nom: true, ville: true, email: true, capacite: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatut(id: string, statut: StatutDevis, userId: string, userRole: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: { demande: true },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');

    // TEACHER can submit for validation or accept/refuse
    if (userRole === Role.TEACHER) {
      if (devis.demande.enseignantId !== userId) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    // DIRECTOR can validate or reject (SELECTIONNE / NON_RETENU)
    if (userRole === Role.DIRECTOR) {
      if (statut !== StatutDevis.SELECTIONNE && statut !== StatutDevis.NON_RETENU) {
        throw new ForbiddenException('Les directeurs peuvent uniquement sélectionner ou refuser un devis');
      }
    }

    const updated = await this.prisma.devis.update({
      where: { id },
      data: { statut },
    });

    // Workflow complet quand un devis est SELECTIONNE
    if (statut === StatutDevis.SELECTIONNE) {
      // 1. Passer tous les autres devis de la même demande en NON_RETENU
      await this.prisma.devis.updateMany({
        where: {
          demandeId: devis.demandeId,
          id: { not: id },
          statut: { not: StatutDevis.NON_RETENU },
        },
        data: { statut: StatutDevis.NON_RETENU },
      });

      // 2. Fermer la demande de devis
      await this.prisma.demandeDevis.update({
        where: { id: devis.demandeId },
        data: { statut: 'FERMEE' },
      });

      // 3. Mettre à jour le séjour : appel d'offres fermé + centre sélectionné + statut CONVENTION
      await this.prisma.sejour.update({
        where: { id: devis.demande.sejourId },
        data: {
          appelOffreStatut: AppelOffreStatut.FERME,
          hebergementSelectionneId: devis.centreId,
          statut: StatutSejour.CONVENTION,
        },
      });

      // 4. Notifier l'hébergeur que son devis est sélectionné
      const centre = await this.prisma.centreHebergement.findUnique({
        where: { id: devis.centreId },
        include: { user: { select: { email: true } } },
      });
      const sejour = await this.prisma.sejour.findUnique({
        where: { id: devis.demande.sejourId },
        select: { titre: true },
      });
      if (centre && sejour) {
        await this.email.sendDevisSelectionne(
          centre.user.email,
          centre.nom,
          sejour.titre,
        );
      }
    }

    return updated;
  }

  async getDevisAValider() {
    return this.prisma.devis.findMany({
      where: { statut: StatutDevis.EN_ATTENTE_VALIDATION },
      include: {
        lignes: true,
        centre: { select: { id: true, nom: true, ville: true, email: true, capacite: true } },
        demande: {
          include: {
            enseignant: { select: { prenom: true, nom: true } },
            sejour: { select: { id: true, titre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextNumeroDevis(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    return { numero: await this.generateNumeroDevis(centre.id) };
  }

  async getDemandeInfo(demandeId: string, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
      include: {
        enseignant: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementEmail: true, etablissementTelephone: true,
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
    });
    if (!demande) throw new NotFoundException('Demande introuvable');

    return { demande, centre };
  }

  private async generateNumeroDevis(centreId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.devis.count({
      where: {
        centreId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    return `DEV-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}
