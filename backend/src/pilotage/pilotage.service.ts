import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutSejour, StatutDevis } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

/** Statuts de séjour considérés comme "confirmés" pour le remplissage. */
const STATUTS_CONFIRMES: StatutSejour[] = ['CONVENTION', 'SOUMIS_RECTORAT', 'SIGNE_DIRECTION', 'DECLARE_TAM'];

/** Statuts de devis considérés comme "CA confirmé". */
const STATUTS_CA: StatutDevis[] = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

/** Formate une date en dd/MM/yyyy. */
function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Formate un nombre avec 2 décimales. */
function fmtNum(n: number): string {
  return n.toFixed(2);
}

/** Ajoute N jours à une date. */
function addDays(d: Date | string, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/** Échappe une valeur CSV (guillemets doubles si contient ; ou "). */
function csvEscape(s: string): string {
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Labels lisibles pour les modes de paiement. */
const MODE_PAIEMENT_LABELS: Record<string, string> = {
  CARTE: 'Carte',
  VIREMENT: 'Virement',
  CHEQUE: 'Chèque',
  ESPECES: 'Espèces',
  CHEQUES_VACANCES: 'Chèques vacances',
};

/** Labels lisibles pour les types de facture. */
const TYPE_FACTURE_LABELS: Record<string, string> = {
  ACOMPTE: 'Acompte',
  SOLDE: 'Solde',
  AVOIR: 'Avoir',
};

/** Plafond dur de l'export ZIP (zip assemblé en mémoire). */
const MAX_FACTURES_ZIP = 300;

/** Formate une date en YYYY-MM-DD (noms de fichiers triables). */
function fmtDateIso(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Slug ASCII pour nom de fichier : accents décomposés, [^a-zA-Z0-9-] → '-', 40 car. max. */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .slice(0, 40);
}

/** Nombre de jours dans un mois donné. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Nombre de jours de chevauchement entre [a1, a2] et [b1, b2] (dates incluses). */
function overlapDays(a1: Date, a2: Date, b1: Date, b2: Date): number {
  const start = a1 > b1 ? a1 : b1;
  const end = a2 < b2 ? a2 : b2;
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
  return diff > 0 ? Math.floor(diff) : 0;
}

/** Date de séjour d'un devis (collab → demande.sejour, direct → sejourDirect). */
function resolveSejourDate(devis: any): { dateDebut: Date | null; titre: string } {
  const dd = devis.sejourDirect?.dateDebut ?? devis.demande?.sejour?.dateDebut ?? null;
  const titre = devis.sejourDirect?.titre ?? devis.demande?.sejour?.titre ?? '—';
  return { dateDebut: dd ? new Date(dd) : null, titre };
}

@Injectable()
export class PilotageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Taux de remplissage ────────────────────────────────────────────

  async getRemplissage(userId: string, centreId: string | null, annee: number) {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const capacite = centre.capacite ?? 0;
    if (capacite === 0) {
      return {
        annee, capacite, tauxAnnuel: 0,
        nuiteesOccupees: 0, nuiteesDisponibles: 0,
        parMois: Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1, taux: 0, nuiteesOccupees: 0, nuiteesDisponibles: 0, nbSejours: 0,
        })),
        comparaisonN1: null,
      };
    }

    const yearStart = new Date(annee, 0, 1);
    const yearEnd = new Date(annee, 11, 31);

    const sejours = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: centre.id,
        statut: { in: STATUTS_CONFIRMES },
        deletedAt: null,
        dateDebut: { lte: yearEnd },
        dateFin: { gte: yearStart },
      },
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        placesTotales: true,
        nombreAccompagnateurs: true,
      },
    });

    const parMois = Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1;
      const monthStart = new Date(annee, i, 1);
      const monthEnd = new Date(annee, i, daysInMonth(annee, mois));
      const nuiteesDisponibles = capacite * daysInMonth(annee, mois);
      let nuiteesOccupees = 0;
      let nbSejours = 0;

      for (const s of sejours) {
        if (!s.dateDebut || !s.dateFin) continue;
        const overlap = overlapDays(
          new Date(s.dateDebut), new Date(s.dateFin),
          monthStart, monthEnd,
        );
        if (overlap > 0) {
          const participants = (s.placesTotales ?? 0) + (s.nombreAccompagnateurs ?? 0);
          nuiteesOccupees += overlap * participants;
          nbSejours++;
        }
      }

      const taux = nuiteesDisponibles > 0
        ? Math.round((nuiteesOccupees / nuiteesDisponibles) * 1000) / 10
        : 0;

      return { mois, taux, nuiteesOccupees, nuiteesDisponibles, nbSejours };
    });

    const totalOccupees = parMois.reduce((s, m) => s + m.nuiteesOccupees, 0);
    const totalDisponibles = parMois.reduce((s, m) => s + m.nuiteesDisponibles, 0);
    const tauxAnnuel = totalDisponibles > 0
      ? Math.round((totalOccupees / totalDisponibles) * 1000) / 10
      : 0;

    // Comparaison N-1 : null si aucun séjour confirmé l'année précédente
    let comparaisonN1: { tauxAnnuel: number; evolution: string } | null = null;
    const prevYearStart = new Date(annee - 1, 0, 1);
    const prevYearEnd = new Date(annee - 1, 11, 31);
    const sejoursPrev = await this.prisma.sejour.count({
      where: {
        hebergementSelectionneId: centre.id,
        statut: { in: STATUTS_CONFIRMES },
        deletedAt: null,
        dateDebut: { lte: prevYearEnd },
        dateFin: { gte: prevYearStart },
      },
    });

    if (sejoursPrev > 0) {
      const prevData = await this.computeRemplissageAnnuel(centre.id, capacite, annee - 1);
      const evolution = tauxAnnuel - prevData.tauxAnnuel;
      const sign = evolution >= 0 ? '+' : '';
      comparaisonN1 = {
        tauxAnnuel: prevData.tauxAnnuel,
        evolution: `${sign}${evolution.toFixed(1)}`,
      };
    }

    return {
      annee, capacite, tauxAnnuel,
      nuiteesOccupees: totalOccupees,
      nuiteesDisponibles: totalDisponibles,
      parMois, comparaisonN1,
    };
  }

  /** Helper : calcul taux remplissage annuel simplifié (pour N-1). */
  private async computeRemplissageAnnuel(centreId: string, capacite: number, annee: number) {
    const yearStart = new Date(annee, 0, 1);
    const yearEnd = new Date(annee, 11, 31);
    const sejours = await this.prisma.sejour.findMany({
      where: {
        hebergementSelectionneId: centreId,
        statut: { in: STATUTS_CONFIRMES },
        deletedAt: null,
        dateDebut: { lte: yearEnd },
        dateFin: { gte: yearStart },
      },
      select: { dateDebut: true, dateFin: true, placesTotales: true, nombreAccompagnateurs: true },
    });

    let totalOccupees = 0;
    for (const s of sejours) {
      if (!s.dateDebut || !s.dateFin) continue;
      const overlap = overlapDays(new Date(s.dateDebut), new Date(s.dateFin), yearStart, yearEnd);
      totalOccupees += overlap * ((s.placesTotales ?? 0) + (s.nombreAccompagnateurs ?? 0));
    }

    const totalDisponibles = capacite * (annee % 4 === 0 ? 366 : 365);
    const tauxAnnuel = totalDisponibles > 0
      ? Math.round((totalOccupees / totalDisponibles) * 1000) / 10
      : 0;
    return { tauxAnnuel };
  }

  // ─── Chiffre d'affaires ─────────────────────────────────────────────

  async getCA(userId: string, centreId: string | null, annee: number) {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const yearStart = new Date(annee, 0, 1);
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59);

    // 1. Devis confirmés du centre (filtrés par date de séjour dans l'année)
    const devis = await this.prisma.devis.findMany({
      where: {
        centreId: centre.id,
        statut: { in: STATUTS_CA },
        isComplementaire: false,
      },
      select: {
        id: true, montantTTC: true, montantTotal: true, statut: true,
        sejourDirect: { select: { dateDebut: true, titre: true, natureSejour: true } },
        demande: {
          select: {
            sourceReseau: true,
            sejour: { select: { dateDebut: true, titre: true, natureSejour: true } },
          },
        },
      },
    });

    // Filtrer par date de séjour dans l'année
    const devisAnnee = devis.filter(d => {
      const { dateDebut } = resolveSejourDate(d);
      return dateDebut && dateDebut >= yearStart && dateDebut <= yearEnd;
    });

    // CA confirmé total
    const confirme = devisAnnee.reduce((s, d) => s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0);

    // Par mois
    const parMois = Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1;
      const monthDevis = devisAnnee.filter(d => {
        const { dateDebut } = resolveSejourDate(d);
        return dateDebut && dateDebut.getMonth() === i;
      });
      return {
        mois,
        confirme: Math.round(monthDevis.reduce((s, d) =>
          s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0) * 100) / 100,
        encaisse: 0, // rempli ci-dessous
      };
    });

    // 2. Versements encaissés dans l'année
    const versements = await this.prisma.versementPaiement.findMany({
      where: {
        devis: { centreId: centre.id },
        datePaiement: { gte: yearStart, lte: yearEnd },
      },
      select: { montant: true, datePaiement: true },
    });

    const encaisse = Math.round(versements.reduce((s, v) => s + v.montant, 0) * 100) / 100;

    for (const v of versements) {
      const mois = new Date(v.datePaiement).getMonth();
      parMois[mois].encaisse = Math.round((parMois[mois].encaisse + v.montant) * 100) / 100;
    }

    // 3. Ventilation par type (SEJOUR vs EVENEMENT)
    let caSejours = 0;
    let caEvenements = 0;
    for (const d of devisAnnee) {
      const nature = d.sejourDirect?.natureSejour ?? d.demande?.sejour?.natureSejour ?? 'SEJOUR';
      const montant = d.montantTTC ?? Number(d.montantTotal) ?? 0;
      if (nature === 'EVENEMENT') caEvenements += montant;
      else caSejours += montant;
    }

    // 4. Ventilation par source (direct vs réseau)
    let caDirect = 0;
    let caReseau = 0;
    for (const d of devisAnnee) {
      const source = d.demande?.sourceReseau;
      const montant = d.montantTTC ?? Number(d.montantTotal) ?? 0;
      if (source) caReseau += montant;
      else caDirect += montant;
    }

    // 4b. Ventilation par produit catalogue
    const lignesConfirmees = await this.prisma.ligneDevis.findMany({
      where: {
        devis: {
          centreId: centre.id,
          statut: { in: STATUTS_CA },
          isComplementaire: false,
        },
      },
      select: {
        totalTTC: true,
        description: true,
        produitCatalogueId: true,
        produitCatalogue: { select: { nom: true, type: true } },
        devis: {
          select: {
            sejourDirect: { select: { dateDebut: true } },
            demande: { select: { sejour: { select: { dateDebut: true } } } },
          },
        },
      },
    });

    // Filtrer par date de séjour dans l'année (même logique que les devis)
    const lignesAnnee = lignesConfirmees.filter(l => {
      const dd = l.devis.sejourDirect?.dateDebut ?? l.devis.demande?.sejour?.dateDebut ?? null;
      if (!dd) return false;
      const d = new Date(dd);
      return d >= yearStart && d <= yearEnd;
    });

    // Agréger par produit catalogue (null = "Autre")
    const produitMap = new Map<string, { nom: string; type: string | null; total: number }>();
    for (const l of lignesAnnee) {
      const key = l.produitCatalogueId ?? '__autre__';
      const nom = l.produitCatalogue?.nom ?? 'Autre';
      const type = l.produitCatalogue?.type ?? null;
      const existing = produitMap.get(key);
      if (existing) {
        existing.total += l.totalTTC;
      } else {
        produitMap.set(key, { nom, type, total: l.totalTTC });
      }
    }

    const parProduit = Array.from(produitMap.values())
      .map(p => ({ nom: p.nom, type: p.type, total: Math.round(p.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    // 5. Comparaison N-1
    let comparaisonN1: { confirme: number; evolution: string } | null = null;
    const prevYearStart = new Date(annee - 1, 0, 1);
    const prevYearEnd = new Date(annee - 1, 11, 31, 23, 59, 59);
    const devisPrev = devis.filter(d => {
      const { dateDebut } = resolveSejourDate(d);
      return dateDebut && dateDebut >= prevYearStart && dateDebut <= prevYearEnd;
    });

    if (devisPrev.length > 0) {
      const confirmePrev = devisPrev.reduce((s, d) =>
        s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0);
      const pct = confirmePrev > 0
        ? ((confirme - confirmePrev) / confirmePrev * 100).toFixed(1)
        : '0.0';
      const sign = Number(pct) >= 0 ? '+' : '';
      comparaisonN1 = {
        confirme: Math.round(confirmePrev * 100) / 100,
        evolution: `${sign}${pct}`,
      };
    }

    return {
      annee,
      confirme: Math.round(confirme * 100) / 100,
      encaisse,
      resteAEncaisser: Math.round((confirme - encaisse) * 100) / 100,
      parMois,
      parType: {
        sejours: Math.round(caSejours * 100) / 100,
        evenements: Math.round(caEvenements * 100) / 100,
      },
      parSource: {
        direct: Math.round(caDirect * 100) / 100,
        reseau: Math.round(caReseau * 100) / 100,
      },
      parProduit,
      comparaisonN1,
    };
  }

  // ─── Export factures (CSV + ZIP des PDF) ───────────────────────────

  /**
   * Source unique de sélection des factures d'un centre sur une période.
   * Avoirs INCLUS — partagée par l'export CSV, le preview et l'export ZIP.
   */
  private getFacturesPeriode(centreId: string, dateDebutStr: string, dateFinStr: string) {
    const dateDebut = new Date(dateDebutStr);
    const dateFin = new Date(dateFinStr);
    dateFin.setHours(23, 59, 59, 999);

    return this.prisma.facture.findMany({
      where: {
        devis: { centreId },
        dateEmission: { gte: dateDebut, lte: dateFin },
      },
      select: {
        id: true,
        numero: true,
        dateEmission: true,
        typeFacture: true,
        destinataireNom: true,
        montantHT: true,
        montantTVA: true,
        montantFacture: true,
        montantVerseTotal: true,
        pdfUrl: true,
        devis: {
          select: {
            versements: {
              select: { modePaiement: true, datePaiement: true },
              orderBy: { datePaiement: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { dateEmission: 'desc' },
    });
  }

  /** Formatage CSV comptable (BOM UTF-8, séparateur ';'). */
  private facturesToCsv(
    factures: Awaited<ReturnType<PilotageService['getFacturesPeriode']>>,
  ): string {
    const BOM = '\uFEFF';
    const header = 'Date;N°;Type;Client;Montant HT;Montant TVA;Montant TTC;Date échéance;Date Paiement;Mode de paiement;Payé';
    const rows = factures.map(f => {
      const isAvoir = f.typeFacture === 'AVOIR';
      const dateEmission = fmtDate(f.dateEmission);
      const echeance = fmtDate(addDays(f.dateEmission, 30));
      // Sur un avoir (montants négatifs), montantVerseTotal >= montantFacture
      // n'a pas de sens : la colonne Payé vaut '—'.
      const paye = !isAvoir && f.montantVerseTotal >= f.montantFacture;
      const dernierVersement = f.devis.versements[0];
      const datePaiement = paye && dernierVersement ? fmtDate(dernierVersement.datePaiement) : '';
      const modePaiement = dernierVersement?.modePaiement
        ? MODE_PAIEMENT_LABELS[dernierVersement.modePaiement] ?? dernierVersement.modePaiement
        : '';

      return [
        dateEmission,
        f.numero,
        TYPE_FACTURE_LABELS[f.typeFacture] ?? f.typeFacture,
        csvEscape(f.destinataireNom),
        fmtNum(f.montantHT),
        fmtNum(f.montantTVA),
        fmtNum(f.montantFacture),
        echeance,
        datePaiement,
        modePaiement,
        isAvoir ? '—' : paye ? 'Oui' : 'Non',
      ].join(';');
    });

    return BOM + header + '\n' + rows.join('\n');
  }

  async exportFacturesCSV(
    userId: string,
    centreId: string | null,
    dateDebutStr: string,
    dateFinStr: string,
  ): Promise<string> {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const factures = await this.getFacturesPeriode(centre.id, dateDebutStr, dateFinStr);
    return this.facturesToCsv(factures);
  }

  /** Aperçu avant export ZIP : combien de factures ont un PDF archivé. */
  async getFacturesPdfPreview(
    userId: string,
    centreId: string | null,
    dateDebutStr: string,
    dateFinStr: string,
  ): Promise<{
    total: number;
    avecPdf: number;
    sansPdf: Array<{ id: string; numero: string; dateEmission: Date }>;
  }> {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const factures = await this.getFacturesPeriode(centre.id, dateDebutStr, dateFinStr);
    const sansPdf = factures
      .filter(f => !f.pdfUrl)
      .map(f => ({ id: f.id, numero: f.numero, dateEmission: f.dateEmission }));
    return { total: factures.length, avecPdf: factures.length - sansPdf.length, sansPdf };
  }

  /** Nom d'un PDF dans le zip : triable par date, numéro unique, client lisible. */
  private nomPdfZip(f: {
    typeFacture: string;
    dateEmission: Date;
    numero: string;
    destinataireNom: string;
  }): string {
    const prefix = f.typeFacture === 'AVOIR' ? 'AVOIR_' : '';
    return `${prefix}${fmtDateIso(f.dateEmission)}_${f.numero}_${slug(f.destinataireNom)}.pdf`;
  }

  async exportFacturesZip(
    userId: string,
    centreId: string | null,
    dateDebutStr: string,
    dateFinStr: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const factures = await this.getFacturesPeriode(centre.id, dateDebutStr, dateFinStr);

    if (factures.length > MAX_FACTURES_ZIP) {
      throw new BadRequestException(
        `Trop de factures sur cette période (${factures.length}). Réduisez l'intervalle.`,
      );
    }

    const avecPdf = factures.filter(f => f.pdfUrl);
    const sansPdf = factures.filter(f => !f.pdfUrl);
    const entries = avecPdf.map(f => ({ nom: this.nomPdfZip(f), url: f.pdfUrl! }));
    const csv = this.facturesToCsv(factures);

    // Évalué par zipFromUrls APRÈS les fetchs : le manifeste couvre les deux
    // causes d'absence — PDF jamais généré (pdfUrl null) ET objet OVH
    // irrécupérable au moment de l'export (`manquants`, noms de fichier zip).
    const extras = (manquants: string[]): Array<{ nom: string; contenu: string | Buffer }> => {
      const fichiers: Array<{ nom: string; contenu: string | Buffer }> = [
        { nom: '_factures.csv', contenu: csv },
      ];
      if (sansPdf.length + manquants.length > 0) {
        const lignes = ['Factures absentes de cette archive :'];
        if (sansPdf.length > 0) {
          lignes.push(
            '',
            '— PDF jamais généré (facture émise sans PDF archivé) :',
            ...sansPdf.map(f => `- ${f.numero} (émise le ${fmtDate(f.dateEmission)})`),
          );
        }
        if (manquants.length > 0) {
          lignes.push(
            '',
            "— PDF introuvable au moment de l'export (fichier archivé inaccessible) :",
            ...manquants.map(nom => `- ${nom}`),
          );
        }
        fichiers.push({ nom: '_PDF_MANQUANTS.txt', contenu: lignes.join('\n') });
      }
      return fichiers;
    };

    const { buffer, manquants } = await this.storage.zipFromUrls(entries, extras);
    if (manquants.length > 0) {
      // pdfUrl renseignée mais objet OVH irrécupérable — détail déjà loggé par fetchAsBuffer.
      console.error(
        `exportFacturesZip: ${manquants.length} PDF irrécupérable(s) : ${manquants.join(', ')}`,
      );
    }

    return { buffer, filename: `factures_LIAVO_${dateDebutStr}_${dateFinStr}.zip` };
  }

  // ─── Export versements CSV ──────────────────────────────────────────

  async exportVersementsCSV(
    userId: string,
    centreId: string | null,
    dateDebutStr: string,
    dateFinStr: string,
  ): Promise<string> {
    const centre = await getCentreForUser(this.prisma, userId, centreId ?? undefined);
    const dateDebut = new Date(dateDebutStr);
    const dateFin = new Date(dateFinStr);
    dateFin.setHours(23, 59, 59, 999);

    const versements = await this.prisma.versementPaiement.findMany({
      where: {
        devis: { centreId: centre.id },
        datePaiement: { gte: dateDebut, lte: dateFin },
      },
      select: {
        montant: true,
        datePaiement: true,
        modePaiement: true,
        reference: true,
        facture: { select: { numero: true } },
        devis: {
          select: {
            sejourDirect: { select: { titre: true, clientOrganisation: true, clientNom: true } },
            demande: {
              select: {
                sejour: { select: { titre: true } },
                enseignant: { select: { prenom: true, nom: true } },
              },
            },
          },
        },
      },
      orderBy: { datePaiement: 'desc' },
    });

    const BOM = '\uFEFF';
    const header = 'Date;Montant;Mode de paiement;Référence;N° Facture;Client;Séjour';
    const rows = versements.map(v => {
      const client = v.devis.sejourDirect?.clientOrganisation
        ?? v.devis.sejourDirect?.clientNom
        ?? (v.devis.demande?.enseignant
          ? `${v.devis.demande.enseignant.prenom} ${v.devis.demande.enseignant.nom}`
          : '—');
      const sejour = v.devis.sejourDirect?.titre
        ?? v.devis.demande?.sejour?.titre
        ?? '—';
      const modePaiement = v.modePaiement
        ? MODE_PAIEMENT_LABELS[v.modePaiement] ?? v.modePaiement
        : '';

      return [
        fmtDate(v.datePaiement),
        fmtNum(v.montant),
        modePaiement,
        csvEscape(v.reference ?? ''),
        v.facture?.numero ?? '',
        csvEscape(client),
        csvEscape(sejour),
      ].join(';');
    });

    return BOM + header + '\n' + rows.join('\n');
  }
}
