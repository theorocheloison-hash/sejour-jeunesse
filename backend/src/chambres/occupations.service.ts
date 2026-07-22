import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { STATUTS_DEVIS_RETENUS } from '../devis/devis-statuts.constants.js';
import { CreateOccupationsDto } from './dto/create-occupations.dto.js';
import { UpdateOccupationDto } from './dto/update-occupation.dto.js';
import { CreateBlocagesDto } from './dto/create-blocages.dto.js';

/**
 * Occupations de chambres + grille + syncOccupationsSejour (sous-chantier 4a —
 * plan validé : docs/run-chambres-4a.md). La primitive est datée [debut, fin)
 * demi-ouvert (rotation des samedis : le jour de départ est libre). Statut
 * TOUJOURS dérivé de l'état des devis (STATUTS_DEVIS_RETENUS — jamais
 * ENGAGEANTS : les devis legacy FACTURE_* restent du CA confirmé, §3.2 doc
 * archi). D12 : ni le POST ni le sync n'échouent sur conflit (A_REPLACER +
 * avertissement) ; seuls les gestes manuels (PATCH, blocage) renvoient 409.
 */

type Db = PrismaService | Prisma.TransactionClient;

type Conflit = {
  chambreId: string;
  nom: string;
  sejourTitre: string | null;
  motif: string | null;
  dateDebut: Date;
  dateFin: Date;
};

// 23P01 (violation d'EXCLUDE) n'est pas mappée par Prisma en erreur « connue »
// (§2.3 doc archi) — détection défensive sur les deux formes du message.
const isConflitExclusion = (e: unknown): boolean => {
  const s = e instanceof Error ? e.message : String(e);
  return s.includes('23P01') || s.includes('occupation_non_chevauchement');
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FENETRE_JOURS = 370;
const JOUR_MS = 24 * 60 * 60 * 1000;

const OCCUPATION_INCLUDE = {
  sejour: { select: { id: true, titre: true } },
} as const;

type OccupationAvecSejour = {
  id: string;
  chambreId: string;
  dateDebut: Date;
  dateFin: Date;
  source: string;
  statut: string;
  motif: string | null;
  etiquette: string | null;
  couleur: string | null;
  sejour: { id: string; titre: string } | null;
};

@Injectable()
export class OccupationsService {
  private readonly logger = new Logger(OccupationsService.name);

  constructor(private prisma: PrismaService) {}

  private mapOccupation(o: OccupationAvecSejour) {
    return {
      id: o.id,
      chambreId: o.chambreId,
      dateDebut: o.dateDebut,
      dateFin: o.dateFin,
      source: o.source,
      statut: o.statut,
      motif: o.motif,
      etiquette: o.etiquette,
      couleur: o.couleur,
      sejour: o.sejour ? { id: o.sejour.id, titre: o.sejour.titre } : null,
    };
  }

  /** Séjour du centre ou 404/403 (pattern capacite.service — couvre COLLAB et DIRECT). */
  private async getSejourDuCentre(sejourId: string, centreId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true,
        titre: true,
        deletedAt: true,
        hebergementSelectionneId: true,
        dateDebut: true,
        dateFin: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.hebergementSelectionneId !== centreId) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }
    return sejour;
  }

  /** Chambres du centre ou 404 (cloisonnement — ne révèle pas l'existence). */
  private async getChambresDuCentre(chambreIds: string[], centreId: string) {
    const uniques = [...new Set(chambreIds)];
    const chambres = await this.prisma.chambre.findMany({
      where: { id: { in: uniques }, centreId },
      select: { id: true, nom: true },
    });
    if (chambres.length !== uniques.length) {
      throw new NotFoundException('Chambre introuvable');
    }
    return chambres;
  }

  /**
   * Occupations FERME chevauchant [debut, fin) sur les chambres données —
   * couche 2 du §4 doc archi (l'UX), à exécuter dans la MÊME transaction que
   * l'écriture ; l'EXCLUDE reste le filet ultime.
   */
  private async chevauchementsFermes(
    db: Db,
    chambreIds: string[],
    debut: Date,
    fin: Date,
    exclureOccupationId?: string,
    // Lot 5 : exclure les occupations d'un séjour donné (elles bougent ensemble
    // au re-datage — une occupation ne se voit pas elle-même en conflit).
    exclureSejourId?: string,
  ): Promise<Conflit[]> {
    const fermes = await db.occupationChambre.findMany({
      where: {
        chambreId: { in: chambreIds },
        statut: 'FERME',
        dateDebut: { lt: fin },
        dateFin: { gt: debut },
        ...(exclureOccupationId ? { id: { not: exclureOccupationId } } : {}),
        ...(exclureSejourId ? { sejourId: { not: exclureSejourId } } : {}),
      },
      include: {
        chambre: { select: { nom: true } },
        sejour: { select: { titre: true } },
      },
    });
    return fermes.map((f) => ({
      chambreId: f.chambreId,
      nom: f.chambre.nom,
      sejourTitre: f.sejour?.titre ?? null,
      motif: f.motif,
      dateDebut: f.dateDebut,
      dateFin: f.dateFin,
    }));
  }

  /** Cible dérivée (§3.2) : FERME si un devis non-complémentaire du séjour est RETENU. */
  private async deriverCible(db: Db, sejourId: string): Promise<'FERME' | 'OPTION'> {
    const retenus = await db.devis.count({
      where: {
        isComplementaire: false,
        statut: { in: STATUTS_DEVIS_RETENUS },
        OR: [{ sejourDirectId: sejourId }, { demande: { sejourId } }],
      },
    });
    return retenus > 0 ? 'FERME' : 'OPTION';
  }

  // ── syncOccupationsSejour — dérivé, idempotent, un seul écrivain (§3.2) ──

  /**
   * Recalcule le statut des occupations SEJOUR d'un séjour depuis l'état de ses
   * devis. Promotion par occupation (une chambre en conflit ne condamne pas les
   * autres), conflit → A_REPLACER (jamais un échec — D12), rétrogradation
   * FERME → OPTION toujours possible (libère le stock), A_REPLACER intouché
   * (résolution = geste manuel — D8). Un site de transition oublié s'auto-répare
   * au prochain appel n'importe où.
   * @param tx dès 4a pour que 4b n'ait pas à changer la signature — aucun site ne le passe encore.
   */
  async syncOccupationsSejour(sejourId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db: Db = tx ?? this.prisma;
    const cible = await this.deriverCible(db, sejourId);
    const occupations = await db.occupationChambre.findMany({
      where: { sejourId, source: 'SEJOUR' },
      select: { id: true, chambreId: true, dateDebut: true, dateFin: true, statut: true },
    });

    for (const occ of occupations) {
      if (occ.statut === 'A_REPLACER' || occ.statut === cible) continue;

      if (cible === 'OPTION') {
        await db.occupationChambre.update({ where: { id: occ.id }, data: { statut: 'OPTION' } });
        continue;
      }

      const conflits = await this.chevauchementsFermes(
        db, [occ.chambreId], occ.dateDebut, occ.dateFin, occ.id,
      );
      if (conflits.length > 0) {
        await db.occupationChambre.update({
          where: { id: occ.id },
          data: { statut: 'A_REPLACER' },
        });
        continue;
      }
      try {
        await db.occupationChambre.update({ where: { id: occ.id }, data: { statut: 'FERME' } });
      } catch (err) {
        // Course entre le check et l'update : le filet 23P01 pose A_REPLACER.
        if (!isConflitExclusion(err)) throw err;
        await db.occupationChambre.update({
          where: { id: occ.id },
          data: { statut: 'A_REPLACER' },
        });
      }
    }
  }

  /**
   * Appel non bloquant pour les sites de signature (D12) : un bug de sync ne
   * fait jamais échouer une écriture déjà commitée ; l'échec se voit et se
   * localise (site + sejourId), l'auto-réparation §3.2 fait le reste.
   */
  async syncOccupationsSejourSafe(sejourId: string, site: string): Promise<void> {
    try {
      await this.syncOccupationsSejour(sejourId);
    } catch (err) {
      this.logger.error(`[sync] échec — site=${site} sejourId=${sejourId}`, err as Error);
    }
  }

  // ── Cascade de re-datage — quand un séjour change de dates (Lot 5) ────────

  /**
   * Cascade : un séjour change de dates → ses occupations « plage complète »
   * suivent (règle A, actée 22/07). SUIVENT uniquement les occupations
   * `source='SEJOUR'` calées sur les ANCIENNES dates du séjour
   * (`[dateDebut, dateFin) == [anciennes]`) — les seules que l'UI V1 crée.
   * NE SUIVENT PAS les sous-périodes custom (dates ≠ dates séjour) : intactes,
   * comptées `nonSuivies`, signalées par un log `[redatage]` (la grille les
   * montre déjà). `anciennes = null` (séjour « à définir » qui reçoit ses dates)
   * → aucune plage complète n'existe → no-op, tout compté `nonSuivies`.
   *
   * Statuts : OPTION → dates seules ; A_REPLACER → dates seules, reste
   * A_REPLACER (D8 : la résolution est un geste manuel, jamais une re-tentative) ;
   * FERME → dates + re-vérification `chevauchementsFermes` aux NOUVELLES dates
   * (en excluant les occupations du même séjour) + filet 23P01 : conflit →
   * A_REPLACER (D6 : jamais de refus du changement de dates, jamais de
   * suppression silencieuse). BLOCAGE hors périmètre (pas de `sejourId`).
   *
   * @param tx OBLIGATOIRE — la cascade s'exécute dans la MÊME transaction que
   *   l'update du séjour (atomicité) ; premier usage réel du `tx?` préparé en 4a.
   */
  async redaterOccupationsSejour(
    sejourId: string,
    anciennes: { debut: Date; fin: Date } | null,
    nouvelles: { debut: Date; fin: Date },
    tx: Prisma.TransactionClient,
  ): Promise<{ redatees: number; passeesAReplacer: number; nonSuivies: number }> {
    const occupations = await tx.occupationChambre.findMany({
      where: { sejourId, source: 'SEJOUR' },
      select: { id: true, chambreId: true, dateDebut: true, dateFin: true, statut: true },
    });

    let redatees = 0;
    let passeesAReplacer = 0;
    let nonSuivies = 0;

    for (const occ of occupations) {
      // Ne suivent que les « plage complète » calées sur les anciennes dates.
      // anciennes=null → aucune ne suit (le POST exige des dates explicites sur
      // un séjour sans dates, donc aucune occupation « plage complète »).
      const suit =
        anciennes !== null &&
        occ.dateDebut.getTime() === anciennes.debut.getTime() &&
        occ.dateFin.getTime() === anciennes.fin.getTime();
      if (!suit) {
        nonSuivies++;
        continue;
      }

      const dates = { dateDebut: nouvelles.debut, dateFin: nouvelles.fin };

      if (occ.statut === 'FERME') {
        // Re-vérification aux nouvelles dates, en excluant les occupations du
        // même séjour (elles bougent ensemble). Conflit → A_REPLACER (D6).
        const conflits = await this.chevauchementsFermes(
          tx, [occ.chambreId], nouvelles.debut, nouvelles.fin, occ.id, sejourId,
        );
        if (conflits.length > 0) {
          await tx.occupationChambre.update({
            where: { id: occ.id },
            data: { ...dates, statut: 'A_REPLACER' },
          });
          passeesAReplacer++;
          continue;
        }
        try {
          await tx.occupationChambre.update({ where: { id: occ.id }, data: dates });
          redatees++;
        } catch (err) {
          // Course entre le check et l'update : le filet 23P01 pose A_REPLACER.
          if (!isConflitExclusion(err)) throw err;
          await tx.occupationChambre.update({
            where: { id: occ.id },
            data: { ...dates, statut: 'A_REPLACER' },
          });
          passeesAReplacer++;
        }
        continue;
      }

      // OPTION (rien à vérifier) et A_REPLACER (reste A_REPLACER — D8) : dates seules.
      await tx.occupationChambre.update({ where: { id: occ.id }, data: dates });
      redatees++;
    }

    if (nonSuivies > 0) {
      this.logger.warn(
        `[redatage] sejourId=${sejourId} : ${nonSuivies} sous-période(s) custom non re-datée(s) (dates ≠ dates séjour) — visibles en grille`,
      );
    }

    return { redatees, passeesAReplacer, nonSuivies };
  }

  // ── Grille de disponibilité (couche 3 — la prévention) ──────────────────

  /** GET /chambres/grille?debut&fin — chambres × occupations sur la fenêtre. */
  async getGrille(userId: string, centreId: string | null | undefined, debutStr?: string, finStr?: string) {
    if (!debutStr || !ISO_DATE.test(debutStr) || !finStr || !ISO_DATE.test(finStr)) {
      throw new BadRequestException('Paramètres debut et fin requis (format YYYY-MM-DD)');
    }
    const debut = new Date(debutStr);
    const fin = new Date(finStr);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime()) || fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }
    if ((fin.getTime() - debut.getTime()) / JOUR_MS > MAX_FENETRE_JOURS) {
      throw new BadRequestException(`Fenêtre limitée à ${MAX_FENETRE_JOURS} jours`);
    }

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const [chambres, occupations] = await Promise.all([
      this.prisma.chambre.findMany({
        where: { centreId: centre.id },
        include: { lits: { select: { places: true } } },
        orderBy: [
          { etage: { sort: 'asc', nulls: 'first' } },
          { ordre: 'asc' },
          { nom: 'asc' },
        ],
      }),
      this.prisma.occupationChambre.findMany({
        where: {
          chambre: { centreId: centre.id },
          dateDebut: { lt: fin },
          dateFin: { gt: debut },
          // Filtre d'affichage (amendement 21/07) : les occupations d'un séjour
          // soft-supprimé n'encombrent pas la grille (suppression réelle = 4b).
          OR: [{ sejourId: null }, { sejour: { deletedAt: null } }],
        },
        include: OCCUPATION_INCLUDE,
        orderBy: { dateDebut: 'asc' },
      }),
    ]);

    const parChambre = new Map<string, OccupationAvecSejour[]>();
    for (const occ of occupations) {
      const liste = parChambre.get(occ.chambreId) ?? [];
      liste.push(occ);
      parChambre.set(occ.chambreId, liste);
    }

    return {
      debut: debutStr,
      fin: finStr,
      chambres: chambres
        // Actives toujours ; inactives seulement si elles portent encore une
        // occupation dans la fenêtre (une A_REPLACER ne doit pas devenir invisible).
        .filter((c) => c.actif || (parChambre.get(c.id)?.length ?? 0) > 0)
        .map((c) => {
          const occs = parChambre.get(c.id) ?? [];
          return {
            id: c.id,
            nom: c.nom,
            etage: c.etage,
            ordre: c.ordre,
            actif: c.actif,
            capacite: c.lits.reduce((s, l) => s + l.places, 0),
            etat: this.etatChambre(occs),
            occupations: occs.map((o) => this.mapOccupation(o)),
          };
        }),
    };
  }

  /** État résumé sur la fenêtre : a_replacer > ferme > bloquee > option ×N > libre. */
  private etatChambre(occs: OccupationAvecSejour[]): { type: string; nbOptions?: number } {
    if (occs.some((o) => o.statut === 'A_REPLACER')) return { type: 'a_replacer' };
    if (occs.some((o) => o.statut === 'FERME' && o.source === 'SEJOUR')) return { type: 'ferme' };
    if (occs.some((o) => o.statut === 'FERME' && o.source === 'BLOCAGE')) return { type: 'bloquee' };
    const sejoursEnOption = new Set(
      occs.filter((o) => o.statut === 'OPTION' && o.sejour).map((o) => o.sejour!.id),
    );
    if (sejoursEnOption.size > 0) return { type: 'option', nbOptions: sejoursEnOption.size };
    return { type: 'libre' };
  }

  // ── POST /chambres/occupations — affecter des chambres à un séjour ───────

  async createOccupations(dto: CreateOccupationsDto, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const sejour = await this.getSejourDuCentre(dto.sejourId, centre.id);

    if ((dto.dateDebut && !dto.dateFin) || (!dto.dateDebut && dto.dateFin)) {
      throw new BadRequestException('Fournissez les deux dates, ou aucune');
    }
    const debut = dto.dateDebut ? new Date(dto.dateDebut) : sejour.dateDebut;
    const fin = dto.dateFin ? new Date(dto.dateFin) : sejour.dateFin;
    if (!debut || !fin) {
      throw new BadRequestException(
        'Ce séjour n\'a pas encore de dates — posez ses dates ou fournissez dateDebut/dateFin',
      );
    }
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }

    const chambres = await this.getChambresDuCentre(dto.chambreIds, centre.id);
    const nomParChambre = new Map(chambres.map((c) => [c.id, c.nom]));
    const idsChambres = chambres.map((c) => c.id);

    // Anti-doublon : le même séjour ne pose pas deux fois la même chambre sur
    // des dates chevauchantes (les sous-périodes disjointes restent possibles).
    const doublons = await this.prisma.occupationChambre.findMany({
      where: {
        sejourId: sejour.id,
        chambreId: { in: idsChambres },
        dateDebut: { lt: fin },
        dateFin: { gt: debut },
      },
      select: { chambreId: true },
    });
    if (doublons.length > 0) {
      const noms = [...new Set(doublons.map((d) => nomParChambre.get(d.chambreId)))].join(', ');
      throw new BadRequestException(`Déjà occupée(s) par ce séjour sur ces dates : ${noms}`);
    }

    const cible = await this.deriverCible(this.prisma, sejour.id);

    // D12 : conflit → naissance A_REPLACER + avertissement, JAMAIS un échec.
    // Filet 23P01 (course entre le check et le commit) : un retry complet, le
    // check revoit alors le FERME gagnant et pose A_REPLACER.
    for (let tentative = 0; ; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const conflits =
            cible === 'FERME'
              ? await this.chevauchementsFermes(tx, idsChambres, debut, fin)
              : [];
          const conflitsParChambre = new Map<string, Conflit[]>();
          for (const c of conflits) {
            const liste = conflitsParChambre.get(c.chambreId) ?? [];
            liste.push(c);
            conflitsParChambre.set(c.chambreId, liste);
          }

          const occupations: OccupationAvecSejour[] = [];
          for (const chambreId of idsChambres) {
            occupations.push(
              await tx.occupationChambre.create({
                data: {
                  chambreId,
                  sejourId: sejour.id,
                  source: 'SEJOUR',
                  statut: conflitsParChambre.has(chambreId) ? 'A_REPLACER' : cible,
                  dateDebut: debut,
                  dateFin: fin,
                },
                include: OCCUPATION_INCLUDE,
              }),
            );
          }

          return {
            occupations: occupations.map((o) => this.mapOccupation(o)),
            avertissements: [...conflitsParChambre.entries()].map(([chambreId, liste]) => ({
              chambreId,
              nom: nomParChambre.get(chambreId) ?? '',
              statut: 'A_REPLACER',
              conflits: liste,
            })),
          };
        });
      } catch (err) {
        if (!isConflitExclusion(err)) throw err;
        if (tentative >= 1) {
          // Double course perdue (improbable) — dernier recours documenté.
          throw new ConflictException({
            statusCode: 409,
            error: 'CHAMBRES_CONFLIT',
            message: 'Conflit de réservation concurrent — réessayez',
            conflits: [],
          });
        }
      }
    }
  }

  // ── PATCH /chambres/occupations/:id — re-dater / marquer / déplacer ──────

  async updateOccupation(
    occupationId: string,
    dto: UpdateOccupationDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const occupation = await this.prisma.occupationChambre.findFirst({
      where: { id: occupationId, chambre: { centreId: centre.id } },
    });
    if (!occupation) throw new NotFoundException('Occupation introuvable');

    const marquage = {
      ...(dto.etiquette !== undefined ? { etiquette: dto.etiquette } : {}),
      ...(dto.couleur !== undefined ? { couleur: dto.couleur } : {}),
    };
    const deplace =
      dto.dateDebut !== undefined || dto.dateFin !== undefined || dto.chambreId !== undefined;

    // Marquage seul (D13) : simple update, aucun recalcul de statut.
    if (!deplace) {
      const maj = await this.prisma.occupationChambre.update({
        where: { id: occupationId },
        data: marquage,
        include: OCCUPATION_INCLUDE,
      });
      return this.mapOccupation(maj);
    }

    const debut = dto.dateDebut ? new Date(dto.dateDebut) : occupation.dateDebut;
    const fin = dto.dateFin ? new Date(dto.dateFin) : occupation.dateFin;
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }
    let chambreId = occupation.chambreId;
    if (dto.chambreId && dto.chambreId !== occupation.chambreId) {
      const [chambre] = await this.getChambresDuCentre([dto.chambreId], centre.id);
      chambreId = chambre.id;
    }

    // Re-datage / changement de chambre = résolution A_REPLACER (D8) : statut
    // recalculé à la cible dérivée. Geste manuel → un conflit se VOIT (409),
    // on ne re-crée pas de l'A_REPLACER en silence.
    const cible =
      occupation.source === 'BLOCAGE'
        ? 'FERME'
        : await this.deriverCible(this.prisma, occupation.sejourId!);

    try {
      const maj = await this.prisma.$transaction(async (tx) => {
        if (cible === 'FERME') {
          const conflits = await this.chevauchementsFermes(
            tx, [chambreId], debut, fin, occupationId,
          );
          if (conflits.length > 0) this.jeterConflit(conflits);
        }
        return tx.occupationChambre.update({
          where: { id: occupationId },
          data: { chambreId, dateDebut: debut, dateFin: fin, statut: cible, ...marquage },
          include: OCCUPATION_INCLUDE,
        });
      });
      return this.mapOccupation(maj);
    } catch (err) {
      if (!isConflitExclusion(err)) throw err;
      // Course : le check n'a pas vu le FERME gagnant — re-lire pour un 409 parlant.
      this.jeterConflit(
        await this.chevauchementsFermes(this.prisma, [chambreId], debut, fin, occupationId),
      );
    }
  }

  // ── DELETE /chambres/occupations/:id — libérer ───────────────────────────

  /** Hard delete ; les affectations suivent par FK Cascade (libérer une chambre libère son rooming). */
  async deleteOccupation(occupationId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const occupation = await this.prisma.occupationChambre.findFirst({
      where: { id: occupationId, chambre: { centreId: centre.id } },
      select: { id: true },
    });
    if (!occupation) throw new NotFoundException('Occupation introuvable');
    await this.prisma.occupationChambre.delete({ where: { id: occupationId } });
    return { deleted: true as const };
  }

  // ── POST /chambres/blocages — blocage manuel (D11) ───────────────────────

  async createBlocages(dto: CreateBlocagesDto, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const debut = new Date(dto.dateDebut);
    const fin = new Date(dto.dateFin);
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }
    const chambres = await this.getChambresDuCentre(dto.chambreIds, centre.id);
    const idsChambres = chambres.map((c) => c.id);

    // Un blocage qui ne bloque pas n'a pas de sens : conflit → 409, tout-ou-rien.
    for (let tentative = 0; ; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const conflits = await this.chevauchementsFermes(tx, idsChambres, debut, fin);
          if (conflits.length > 0) this.jeterConflit(conflits);
          const occupations: OccupationAvecSejour[] = [];
          for (const chambreId of idsChambres) {
            occupations.push(
              await tx.occupationChambre.create({
                data: {
                  chambreId,
                  source: 'BLOCAGE',
                  statut: 'FERME',
                  motif: dto.motif,
                  dateDebut: debut,
                  dateFin: fin,
                },
                include: OCCUPATION_INCLUDE,
              }),
            );
          }
          return { occupations: occupations.map((o) => this.mapOccupation(o)) };
        });
      } catch (err) {
        if (!isConflitExclusion(err)) throw err;
        if (tentative >= 1) {
          // Double course perdue : re-lire pour un 409 parlant — jamais un
          // 500 brut sur 23P01 (§2.3 doc archi).
          this.jeterConflit(
            await this.chevauchementsFermes(this.prisma, idsChambres, debut, fin),
          );
        }
        // Course simple : au retry, le check applicatif voit le FERME gagnant → 409 parlant.
      }
    }
  }

  /** 409 structuré — jamais un 500 brut sur 23P01 (§2.3 doc archi). */
  private jeterConflit(conflits: Conflit[]): never {
    const premier = conflits[0];
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR');
    throw new ConflictException({
      statusCode: 409,
      error: 'CHAMBRES_CONFLIT',
      message: premier
        ? `${premier.nom} tenue par ${premier.sejourTitre ? `« ${premier.sejourTitre} »` : `un blocage (${premier.motif ?? 'sans motif'})`} du ${fmt(premier.dateDebut)} au ${fmt(premier.dateFin)}`
        : 'Conflit de réservation',
      conflits,
    });
  }
}
