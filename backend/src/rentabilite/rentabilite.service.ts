import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { CreateFacturePrestatireDto } from './dto/create-facture-prestataire.dto.js';

@Injectable()
export class RentabiliteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Valide le montant total et, le cas échéant, la cohérence + l'ownership
   * des ventilations. Partagé entre création et mise à jour.
   */
  private async validateMontantEtVentilations(
    dto: CreateFacturePrestatireDto,
    centreId: string,
  ): Promise<void> {
    if (dto.montantTotalTTC <= 0) {
      throw new BadRequestException('Montant invalide');
    }

    if (dto.ventilations.length > 0) {
      const totalVentile = dto.ventilations.reduce(
        (sum, v) => sum + v.montantTTC,
        0,
      );
      if (totalVentile > dto.montantTotalTTC + 0.01) {
        throw new BadRequestException(
          'Total ventilé dépasse le montant de la facture',
        );
      }

      for (const ventilation of dto.ventilations) {
        const sejour = await this.prisma.sejour.findUnique({
          where: { id: ventilation.sejourId },
          select: { hebergementSelectionneId: true, deletedAt: true },
        });
        if (
          !sejour ||
          sejour.deletedAt ||
          sejour.hebergementSelectionneId !== centreId
        ) {
          throw new ForbiddenException(
            `Séjour ${ventilation.sejourId} inaccessible`,
          );
        }
      }
    }
  }

  /** Crée une facture prestataire + ses ventilations (nested create atomique). */
  async createFacture(
    dto: CreateFacturePrestatireDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.validateMontantEtVentilations(dto, centre.id);

    return this.prisma.facturePrestataire.create({
      data: {
        centreId: centre.id,
        nomPrestataire: dto.nomPrestataire,
        typeCharge: dto.typeCharge,
        numeroFacture: dto.numeroFacture ?? null,
        dateFacture: dto.dateFacture ? new Date(dto.dateFacture) : null,
        montantTotalTTC: dto.montantTotalTTC,
        notes: dto.notes ?? null,
        ventilations: {
          create: dto.ventilations.map((v) => ({
            sejourId: v.sejourId,
            montantTTC: v.montantTTC,
          })),
        },
      },
      include: { ventilations: true },
    });
  }

  /** Liste les factures du centre, avec filtre optionnel par séjour ventilé. */
  async getMesFactures(
    userId: string,
    centreId?: string | null,
    sejourIdFilter?: string,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.prisma.facturePrestataire.findMany({
      where: {
        centreId: centre.id,
        ...(sejourIdFilter
          ? { ventilations: { some: { sejourId: sejourIdFilter } } }
          : {}),
      },
      include: { ventilations: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Met à jour une facture : replace complet des ventilations en transaction. */
  async updateFacture(
    id: string,
    dto: CreateFacturePrestatireDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const facture = await this.prisma.facturePrestataire.findUnique({
      where: { id },
    });
    if (!facture || facture.centreId !== centre.id) {
      throw new ForbiddenException('Facture inaccessible');
    }

    await this.validateMontantEtVentilations(dto, centre.id);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.ventilationSejourPrestataire.deleteMany({
        where: { factureId: id },
      }),
      this.prisma.facturePrestataire.update({
        where: { id },
        data: {
          nomPrestataire: dto.nomPrestataire,
          typeCharge: dto.typeCharge,
          numeroFacture: dto.numeroFacture ?? null,
          dateFacture: dto.dateFacture ? new Date(dto.dateFacture) : null,
          montantTotalTTC: dto.montantTotalTTC,
          notes: dto.notes ?? null,
          ventilations: {
            create: dto.ventilations.map((v) => ({
              sejourId: v.sejourId,
              montantTTC: v.montantTTC,
            })),
          },
        },
        include: { ventilations: true },
      }),
    ]);

    return updated;
  }

  /** Supprime une facture (cascade sur les ventilations via Prisma). */
  async deleteFacture(id: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const facture = await this.prisma.facturePrestataire.findUnique({
      where: { id },
    });
    if (!facture || facture.centreId !== centre.id) {
      throw new ForbiddenException('Facture inaccessible');
    }

    await this.prisma.facturePrestataire.delete({ where: { id } });
    return { success: true };
  }

  /** Attache un justificatif (PDF/JPEG/PNG, max 10 Mo) à une facture. */
  async uploadFichier(
    id: string,
    userId: string,
    file: Express.Multer.File,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const facture = await this.prisma.facturePrestataire.findUnique({
      where: { id },
    });
    if (!facture || facture.centreId !== centre.id) {
      throw new ForbiddenException('Facture inaccessible');
    }

    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}`,
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop volumineux (max 10 Mo)');
    }

    const url = await this.storageService.upload(file, 'factures-prestataires');
    await this.prisma.facturePrestataire.update({
      where: { id },
      data: { fichierUrl: url },
    });
    return { fichierUrl: url };
  }

  /** Tableau P&L par séjour : CA facturé − charges prestataires ventilées. */
  async getTableau(
    userId: string,
    centreId?: string | null,
    mois?: string,
    annee?: string,
    sejourIdFilter?: string,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // 1. Construire le filtre de date sur dateDebut du séjour
    const dateFilter: any = {};
    if (mois) {
      // format '2026-01'
      const [y, m] = mois.split('-').map(Number);
      dateFilter.gte = new Date(y, m - 1, 1);
      dateFilter.lt = new Date(y, m, 1);
    } else if (annee) {
      dateFilter.gte = new Date(Number(annee), 0, 1);
      dateFilter.lt = new Date(Number(annee) + 1, 0, 1);
    }

    // 2. Récupérer les séjours du centre
    const sejours = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: centre.id,
        deletedAt: null,
        ...(sejourIdFilter ? { id: sejourIdFilter } : {}),
        ...(Object.keys(dateFilter).length ? { dateDebut: dateFilter } : {}),
      },
      select: {
        id: true,
        titre: true,
        dateDebut: true,
        dateFin: true,
        natureSejour: true,
        ventilationsPrestataires: { select: { montantTTC: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });

    // 3. Pour chaque séjour, calculer le CA
    const PRIORITE_STATUT = [
      'FACTURE_SOLDE',
      'FACTURE_ACOMPTE',
      'SIGNE_DIRECTION',
      'SELECTIONNE',
      'EN_ATTENTE_VALIDATION',
      'EN_ATTENTE',
    ];

    const result = await Promise.all(
      sejours.map(async (sejour) => {
        // Trouver le devis le plus avancé de CE centre pour ce séjour
        const devisCandidats = await this.prisma.devis.findMany({
          where: {
            centreId: centre.id, // ← OBLIGATOIRE : ne prendre que les devis de ce centre
            statut: {
              in: [
                'SELECTIONNE',
                'SIGNE_DIRECTION',
                'FACTURE_ACOMPTE',
                'FACTURE_SOLDE',
                'EN_ATTENTE',
                'EN_ATTENTE_VALIDATION',
              ],
            },
            OR: [
              { sejourDirectId: sejour.id },
              { demande: { sejourId: sejour.id } },
            ],
          },
          include: {
            factures: {
              where: { typeFacture: 'SOLDE' },
              select: { montantFacture: true },
            },
          },
        });

        // Trier par priorité statut
        const meilleurDevis =
          devisCandidats.sort(
            (a, b) =>
              PRIORITE_STATUT.indexOf(a.statut) -
              PRIORITE_STATUT.indexOf(b.statut),
          )[0] ?? null;

        let caTTC = 0;
        if (meilleurDevis) {
          const factureSolde = meilleurDevis.factures[0];
          caTTC = factureSolde
            ? factureSolde.montantFacture
            : (meilleurDevis.montantTTC ?? 0);
        }

        const chargesTTC = sejour.ventilationsPrestataires.reduce(
          (sum, v) => sum + v.montantTTC,
          0,
        );
        const margeTTC = caTTC - chargesTTC;
        const tauxMarge = caTTC > 0 ? (margeTTC / caTTC) * 100 : null;

        return {
          sejourId: sejour.id,
          titre: sejour.titre,
          dateDebut: sejour.dateDebut,
          dateFin: sejour.dateFin,
          natureSejour: sejour.natureSejour,
          caTTC: Math.round(caTTC * 100) / 100,
          chargesTTC: Math.round(chargesTTC * 100) / 100,
          margeTTC: Math.round(margeTTC * 100) / 100,
          tauxMarge:
            tauxMarge !== null ? Math.round(tauxMarge * 10) / 10 : null,
          nbVentilations: sejour.ventilationsPrestataires.length,
        };
      }),
    );

    // 4. Totaux
    const totaux = result.reduce(
      (acc, s) => ({
        caTTC: acc.caTTC + s.caTTC,
        chargesTTC: acc.chargesTTC + s.chargesTTC,
        margeTTC: acc.margeTTC + s.margeTTC,
      }),
      { caTTC: 0, chargesTTC: 0, margeTTC: 0 },
    );

    const tauxTotal =
      totaux.caTTC > 0
        ? Math.round((totaux.margeTTC / totaux.caTTC) * 1000) / 10
        : null;

    return {
      sejours: result,
      totaux: { ...totaux, tauxMarge: tauxTotal },
    };
  }
}
