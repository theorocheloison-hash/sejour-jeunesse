import { Injectable } from '@nestjs/common';
import { StatutSejour, StatutDevis } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

/** Statuts de séjour considérés comme "confirmés" pour le remplissage. */
const STATUTS_CONFIRMES: StatutSejour[] = ['CONVENTION', 'SOUMIS_RECTORAT', 'SIGNE_DIRECTION', 'DECLARE_TAM'];

/** Statuts de devis considérés comme "CA confirmé". */
const STATUTS_CA: StatutDevis[] = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

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
  constructor(private readonly prisma: PrismaService) {}

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
      comparaisonN1,
    };
  }
}
