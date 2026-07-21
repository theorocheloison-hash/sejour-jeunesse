import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatutSejour } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { STATUTS_SEJOUR_CONFIRMES } from '../sejours/sejour-statuts.constants.js';

/**
 * Étage 1 du système de conflit chambres : alerte de capacité globale, dès le
 * devis, AVANT toute affectation de chambres (docs/ARCHITECTURE_MODULE_CHAMBRES.md
 * §4, D9/D10 ; plan validé : docs/run-chambres-1.md).
 *
 * Tout est DÉRIVÉ au read — aucune table, aucun cron, aucun branchement dans les
 * transitions devis. Seul écrit : le couple d'acquittement sur Sejour
 * (capaciteAlerteAcquitteeAt + capaciteAlerteSituation).
 *
 * « Signé » = Sejour.statut ∈ STATUTS_SEJOUR_CONFIRMES (même définition que le
 * remplissage Pilotage — l'alerte et le taux racontent le même monde ; couvre
 * creerDepuisCatalogue, né CONVENTION sans devis signé). Nuitées demi-ouvertes
 * [dateDebut, dateFin) : le jour de départ est libre, deux séjours en rotation
 * du samedi ne s'additionnent pas (convention chambre §2.3).
 */

interface SejourSigne {
  id: string;
  dateDebut: Date;
  dateFin: Date;
  effectif: number;
}

export interface AlerteCapacite {
  sejourId: string;
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  effectif: number;
  maxOccupationSignee: number;
  deficit: number;
  etat: 'ACTIVE' | 'ACQUITTEE';
  capaciteAlerteAcquitteeAt: Date | null;
}

const effectifSejour = (s: { placesTotales: number | null; nombreAccompagnateurs: number | null }) =>
  (s.placesTotales ?? 0) + (s.nombreAccompagnateurs ?? 0);

const jourISO = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class CapaciteService {
  constructor(private prisma: PrismaService) {}

  /**
   * Max journalier de Σ effectifs des séjours signés sur la fenêtre [debut, fin)
   * de l'option. Balayage des bornes (événements ±effectif), O(n log n), aucune
   * requête — les chevauchants sont clippés à la fenêtre avant le balayage.
   */
  private maxOccupationSignee(debut: Date, fin: Date, signes: SejourSigne[]): number {
    const events: Array<[number, number]> = [];
    for (const s of signes) {
      const clipDebut = Math.max(s.dateDebut.getTime(), debut.getTime());
      const clipFin = Math.min(s.dateFin.getTime(), fin.getTime());
      if (clipDebut >= clipFin) continue; // [ , ) : pas de nuit commune
      events.push([clipDebut, s.effectif], [clipFin, -s.effectif]);
    }
    // Aux bornes identiques, les fins passent avant les débuts (le jour de
    // départ est libre) : tri par date puis par delta croissant (négatifs d'abord).
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let courant = 0;
    let max = 0;
    for (const [, delta] of events) {
      courant += delta;
      if (courant > max) max = courant;
    }
    return max;
  }

  /**
   * Empreinte canonique de la situation (D10 : un acquittement ne vaut que pour
   * la situation acquittée). Couvre : capacité du centre, effectif + dates de
   * l'option, ensemble trié (id, effectif, dates) des signés chevauchants.
   * Toute divergence entre l'empreinte courante et celle stockée à
   * l'acquittement réarme l'alerte — et rien d'autre ne la réarme (anti-bruit :
   * updatedAt bouge sur chaque inscription, pas la situation).
   */
  private empreinteSituation(
    capacite: number,
    option: { dateDebut: Date; dateFin: Date; effectif: number },
    chevauchants: SejourSigne[],
  ): string {
    const canonique = JSON.stringify({
      capacite,
      effectif: option.effectif,
      debut: jourISO(option.dateDebut),
      fin: jourISO(option.dateFin),
      signes: [...chevauchants]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((s) => [s.id, s.effectif, jourISO(s.dateDebut), jourISO(s.dateFin)]),
    });
    return createHash('sha256').update(canonique).digest('hex');
  }

  /** Les 2 requêtes du calcul — dates nulles hors calcul, deletedAt exclus. */
  private async chargerSejours(centreId: string) {
    const baseWhere = {
      hebergementSelectionneId: centreId,
      deletedAt: null,
      dateDebut: { not: null },
      dateFin: { not: null },
    };
    const [options, signesRaw] = await Promise.all([
      this.prisma.sejour.findMany({
        where: { ...baseWhere, statut: StatutSejour.OPTION },
        select: {
          id: true,
          titre: true,
          dateDebut: true,
          dateFin: true,
          placesTotales: true,
          nombreAccompagnateurs: true,
          capaciteAlerteAcquitteeAt: true,
          capaciteAlerteSituation: true,
        },
      }),
      this.prisma.sejour.findMany({
        where: { ...baseWhere, statut: { in: STATUTS_SEJOUR_CONFIRMES } },
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          placesTotales: true,
          nombreAccompagnateurs: true,
        },
      }),
    ]);
    const signes: SejourSigne[] = signesRaw.map((s) => ({
      id: s.id,
      dateDebut: s.dateDebut!,
      dateFin: s.dateFin!,
      effectif: effectifSejour(s),
    }));
    return { options, signes };
  }

  /** null si l'option reste accueillable, sinon l'alerte (ACTIVE ou ACQUITTEE). */
  private evaluerOption(
    option: {
      id: string;
      titre: string;
      dateDebut: Date | null;
      dateFin: Date | null;
      placesTotales: number | null;
      nombreAccompagnateurs: number | null;
      capaciteAlerteAcquitteeAt: Date | null;
      capaciteAlerteSituation: string | null;
    },
    signes: SejourSigne[],
    capacite: number,
  ): AlerteCapacite | null {
    if (!option.dateDebut || !option.dateFin) return null;
    const effectif = effectifSejour(option);
    const chevauchants = signes.filter(
      (s) => s.dateDebut < option.dateFin! && s.dateFin > option.dateDebut!,
    );
    const maxSignes = this.maxOccupationSignee(option.dateDebut, option.dateFin, chevauchants);
    if (maxSignes + effectif <= capacite) return null;

    const empreinte = this.empreinteSituation(
      capacite,
      { dateDebut: option.dateDebut, dateFin: option.dateFin, effectif },
      chevauchants,
    );
    const acquittee =
      option.capaciteAlerteAcquitteeAt !== null &&
      option.capaciteAlerteSituation === empreinte;

    return {
      sejourId: option.id,
      titre: option.titre,
      dateDebut: option.dateDebut,
      dateFin: option.dateFin,
      effectif,
      maxOccupationSignee: maxSignes,
      deficit: maxSignes + effectif - capacite,
      etat: acquittee ? 'ACQUITTEE' : 'ACTIVE',
      capaciteAlerteAcquitteeAt: option.capaciteAlerteAcquitteeAt,
    };
  }

  /** GET /chambres/alertes-capacite — alertes « option plus accueillable » du centre. */
  async getAlertes(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const { options, signes } = await this.chargerSejours(centre.id);
    const alertes = options
      .map((o) => this.evaluerOption(o, signes, centre.capacite ?? 0))
      .filter((a): a is AlerteCapacite => a !== null);
    return { capacite: centre.capacite ?? 0, alertes };
  }

  /**
   * PATCH /chambres/alertes-capacite/:sejourId/acquitter — « j'ai prévenu le
   * client » : pose l'acquittement daté + l'empreinte de la situation acquittée.
   * L'option reste vivante (file d'attente, D10) ; refuse s'il n'y a rien à
   * acquitter (pas de surcapacité).
   */
  async acquitter(sejourId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true,
        titre: true,
        statut: true,
        deletedAt: true,
        hebergementSelectionneId: true,
        dateDebut: true,
        dateFin: true,
        placesTotales: true,
        nombreAccompagnateurs: true,
        capaciteAlerteAcquitteeAt: true,
        capaciteAlerteSituation: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }
    if (sejour.statut !== StatutSejour.OPTION) {
      throw new BadRequestException('Seul un séjour en option porte une alerte de capacité');
    }

    const { signes } = await this.chargerSejours(centre.id);
    const alerte = this.evaluerOption(sejour, signes, centre.capacite ?? 0);
    if (!alerte) {
      throw new BadRequestException('Aucune alerte de capacité à acquitter pour ce séjour');
    }

    const empreinte = this.empreinteSituation(
      centre.capacite ?? 0,
      { dateDebut: sejour.dateDebut!, dateFin: sejour.dateFin!, effectif: alerte.effectif },
      signes.filter((s) => s.dateDebut < sejour.dateFin! && s.dateFin > sejour.dateDebut!),
    );
    const updated = await this.prisma.sejour.update({
      where: { id: sejourId },
      data: {
        capaciteAlerteAcquitteeAt: new Date(),
        capaciteAlerteSituation: empreinte,
      },
      select: { id: true, capaciteAlerteAcquitteeAt: true },
    });

    return {
      sejourId: updated.id,
      capaciteAlerteAcquitteeAt: updated.capaciteAlerteAcquitteeAt,
      etat: 'ACQUITTEE' as const,
    };
  }
}
