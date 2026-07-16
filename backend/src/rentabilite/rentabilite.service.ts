import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { STATUTS_DEVIS_RETENUS } from '../devis/devis-statuts.constants.js';
import { CreateFacturePrestatireDto } from './dto/create-facture-prestataire.dto.js';

@Injectable()
export class RentabiliteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /** Arrondi comptable à 2 décimales. */
  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

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

  /**
   * TVA sur marge (art. 266-1-e CGI) : les prestations REVENDUES achetées à des
   * tiers (lignes de devis flaguées revenduTiers) sont imposées sur la marge
   * (vente TTC − achat TTC), pas sur le CA. La pension produite en propre est
   * hors calcul. Distinct de la marge ÉCONOMIQUE de getTableau().
   *
   * LIAVO restitue le tableau ; l'expert-comptable du centre déclare. Aucune
   * règle fiscale n'est appliquée ici : pas de plancher à zéro, pas de report,
   * pas de compensation inter-mois — une marge négative est conservée signée.
   *
   * Rattachement mensuel = sejour.dateDebut, y compris pour un séjour à cheval
   * sur deux mois. Exactement 4 requêtes, toute l'agrégation est en mémoire.
   */
  async getTvaSurMarge(
    userId: string,
    centreId: string | null | undefined,
    annee: number,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    if (!centre.regimeMargeActif) {
      throw new BadRequestException('Régime de la marge non activé');
    }


    // Q1 — séjours du centre dans l'année (dateDebut), avec leurs achats.
    // La traversée ventilation → facture est obligatoire : typeCharge est
    // porté par FacturePrestataire, pas par la ventilation.
    const sejours = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: centre.id,
        deletedAt: null,
        dateDebut: {
          gte: new Date(Date.UTC(annee, 0, 1)),
          lte: new Date(Date.UTC(annee, 11, 31)),
        },
      },
      select: {
        id: true,
        titre: true,
        dateDebut: true,
        natureSejour: true,
        ventilationsPrestataires: {
          select: {
            montantTTC: true,
            facture: { select: { id: true, typeCharge: true } },
          },
        },
      },
    });
    const sejourIds = sejours.map((s) => s.id);

    // Q2 — devis rattachés à ces séjours (modes DIRECT et COLLAB), avec leurs
    // seules lignes revendues à des tiers. Tous les devis retenus (EN_ATTENTE,
    // EN_ATTENTE_VALIDATION et NON_RETENU sont exclus de la base)
    // comptent, complémentaires inclus : pas de tri PRIORITE_STATUT ici, il ne
    // retiendrait qu'un devis et ferait tomber des lignes hors base.
    const devisList = await this.prisma.devis.findMany({
      where: {
        centreId: centre.id,
        statut: { in: STATUTS_DEVIS_RETENUS },
        OR: [
          { sejourDirectId: { in: sejourIds } },
          { demande: { sejourId: { in: sejourIds } } },
        ],
      },
      select: {
        id: true,
        isComplementaire: true,
        sejourDirectId: true,
        demande: { select: { sejourId: true } },
        lignes: {
          where: { revenduTiers: true },
          select: { totalTTC: true, categorieMarge: true },
        },
      },
    });

    // Q3 — toutes les factures prestataires du centre avec TOUTES leurs
    // ventilations (y compris hors périmètre annuel) : détection de la
    // sous-ventilation, que validateMontantEtVentilations() laisse passer.
    const facturesPrestataires = await this.prisma.facturePrestataire.findMany({
      where: { centreId: centre.id },
      select: {
        id: true,
        nomPrestataire: true,
        montantTotalTTC: true,
        ventilations: { select: { montantTTC: true } },
      },
    });

    // Q4 — séjours sans dateDebut portant des charges : ils ne tomberaient
    // dans aucun mois et disparaîtraient sans signal.
    const sejoursSansDate = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: centre.id,
        deletedAt: null,
        dateDebut: null,
        ventilationsPrestataires: { some: {} },
      },
      select: { id: true, titre: true },
    });

    // ── Agrégation en mémoire ──
    const anomalies: Array<{
      type: string;
      sejourId?: string;
      titre?: string;
      factureId?: string;
      montant?: number;
      message: string;
    }> = [];

    // parPoste : clé normalisée (trim + lowercase) commune aux catégories de
    // vente (ligneDevis.categorieMarge) et d'achat (facture.typeCharge) ;
    // label = première valeur d'origine rencontrée pour la clé.
    const parPosteMap = new Map<
      string,
      { cle: string; label: string; venteTTC: number; achatTTC: number }
    >();
    const addPoste = (
      valeur: string | null | undefined,
      vente: number,
      achat: number,
    ) => {
      const brut = (valeur ?? '').trim();
      const cle = brut === '' ? 'non_categorise' : brut.toLowerCase();
      const entry = parPosteMap.get(cle);
      if (entry) {
        entry.venteTTC += vente;
        entry.achatTTC += achat;
      } else {
        parPosteMap.set(cle, {
          cle,
          label: brut === '' ? 'Non catégorisé' : brut,
          venteTTC: vente,
          achatTTC: achat,
        });
      }
    };

    // Ventes par séjour + comptage des devis principaux (double comptage).
    const venteParSejour = new Map<string, number>();
    const devisPrincipauxParSejour = new Map<string, number>();
    for (const devis of devisList) {
      // Résolution du séjour : DIRECT (sejourDirectId) ou COLLAB (demande.sejourId).
      const sejourId = devis.sejourDirectId ?? devis.demande?.sejourId;
      if (!sejourId) continue;
      if (!devis.isComplementaire) {
        devisPrincipauxParSejour.set(
          sejourId,
          (devisPrincipauxParSejour.get(sejourId) ?? 0) + 1,
        );
      }
      for (const ligne of devis.lignes) {
        venteParSejour.set(
          sejourId,
          (venteParSejour.get(sejourId) ?? 0) + ligne.totalTTC,
        );
        addPoste(ligne.categorieMarge, ligne.totalTTC, 0);
      }
    }

    // Cumuls mensuels bruts (arrondis une seule fois, au niveau du mois).
    const ventesMois = new Array<number>(12).fill(0);
    const achatsMois = new Array<number>(12).fill(0);
    const nbSejoursMois = new Array<number>(12).fill(0);
    for (const sejour of sejours) {
      if (!sejour.dateDebut) continue; // impossible (filtre Q1), garde TS
      const mois = sejour.dateDebut.getUTCMonth();
      const vente = venteParSejour.get(sejour.id) ?? 0;
      let achat = 0;
      for (const ventilation of sejour.ventilationsPrestataires) {
        achat += ventilation.montantTTC;
        addPoste(ventilation.facture.typeCharge, 0, ventilation.montantTTC);
      }
      ventesMois[mois] += vente;
      achatsMois[mois] += achat;
      if (vente !== 0 || achat !== 0) nbSejoursMois[mois]++;

      if (achat > 0 && vente === 0) {
        anomalies.push({
          type: 'ACHAT_SANS_VENTE',
          sejourId: sejour.id,
          titre: sejour.titre,
          montant: this.round2(achat),
          message: `Séjour « ${sejour.titre} » : achats ventilés sans aucune ligne de vente flaguée revendue (flag oublié ?)`,
        });
      }
      if (vente > 0 && achat === 0) {
        anomalies.push({
          type: 'VENTE_SANS_ACHAT',
          sejourId: sejour.id,
          titre: sejour.titre,
          montant: this.round2(vente),
          message: `Séjour « ${sejour.titre} » : ventes revendues sans aucun achat ventilé (facture prestataire pas encore saisie ?)`,
        });
      }
      const nbPrincipaux = devisPrincipauxParSejour.get(sejour.id) ?? 0;
      if (nbPrincipaux >= 2) {
        anomalies.push({
          type: 'PLUSIEURS_DEVIS_PRINCIPAUX',
          sejourId: sejour.id,
          titre: sejour.titre,
          message: `Séjour « ${sejour.titre} » : ${nbPrincipaux} devis principaux en statut facturable — double comptage possible de la vente`,
        });
      }
    }

    // Anomalie FACTURE_SOUS_VENTILEE (le validateur ne rejette que la
    // sur-ventilation : le reliquat non ventilé passerait silencieusement).
    for (const facture of facturesPrestataires) {
      const totalVentile = facture.ventilations.reduce(
        (sum, v) => sum + v.montantTTC,
        0,
      );
      if (totalVentile < facture.montantTotalTTC - 0.01) {
        anomalies.push({
          type: 'FACTURE_SOUS_VENTILEE',
          factureId: facture.id,
          montant: this.round2(facture.montantTotalTTC - totalVentile),
          message: `Facture « ${facture.nomPrestataire} » : ${this.round2(facture.montantTotalTTC - totalVentile)} € non ventilés — charge orpheline, marge faussée`,
        });
      }
    }

    for (const sejour of sejoursSansDate) {
      anomalies.push({
        type: 'SEJOUR_SANS_DATE',
        sejourId: sejour.id,
        titre: sejour.titre,
        message: `Séjour « ${sejour.titre} » : charges ventilées mais aucune date de début — ces montants ne tombent dans aucun mois`,
      });
    }

    // ── Calcul mensuel — ordre des arrondis impératif (cohérence comptable) :
    // margeTTC = round2(vente − achat), baseHT = round2(marge / (1 + taux/100)),
    // tva = round2(marge − baseHT) : DÉRIVÉE, jamais recalculée séparément,
    // pour garantir baseHT + tva === margeTTC au centime près.
    const taux = centre.tauxTvaMarge;
    const parMois = ventesMois.map((_, i) => {
      const venteTTC = this.round2(ventesMois[i]);
      const achatTTC = this.round2(achatsMois[i]);
      const margeTTC = this.round2(venteTTC - achatTTC);
      const baseHT = this.round2(margeTTC / (1 + taux / 100));
      const tva = this.round2(margeTTC - baseHT);
      return {
        mois: i + 1,
        venteTTC,
        achatTTC,
        margeTTC,
        baseHT,
        tva,
        nbSejours: nbSejoursMois[i],
      };
    });

    // Totaux = somme des 12 valeurs mensuelles DÉJÀ arrondies (round2 final
    // uniquement pour purger le bruit flottant de l'addition) : la colonne
    // s'additionne dans l'export destiné à l'expert-comptable.
    const totaux = {
      venteTTC: this.round2(parMois.reduce((s, m) => s + m.venteTTC, 0)),
      achatTTC: this.round2(parMois.reduce((s, m) => s + m.achatTTC, 0)),
      margeTTC: this.round2(parMois.reduce((s, m) => s + m.margeTTC, 0)),
      baseHT: this.round2(parMois.reduce((s, m) => s + m.baseHT, 0)),
      tva: this.round2(parMois.reduce((s, m) => s + m.tva, 0)),
    };

    const parPoste = [...parPosteMap.values()]
      .map((poste) => {
        const venteTTC = this.round2(poste.venteTTC);
        const achatTTC = this.round2(poste.achatTTC);
        const margeTTC = this.round2(venteTTC - achatTTC);
        const tauxMarge =
          venteTTC === 0
            ? null
            : Math.round((margeTTC / venteTTC) * 1000) / 10;
        return { cle: poste.cle, label: poste.label, venteTTC, achatTTC, margeTTC, tauxMarge };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

    return { annee, tauxTvaMarge: taux, parMois, parPoste, totaux, anomalies };
  }
}
