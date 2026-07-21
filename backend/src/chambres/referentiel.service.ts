import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { CreateChambreDto } from './dto/create-chambre.dto.js';
import { CreateLitDto } from './dto/create-lit.dto.js';
import { UpdateChambreDto } from './dto/update-chambre.dto.js';
import { UpdateLitDto } from './dto/update-lit.dto.js';

/**
 * Référentiel physique chambres/lits (sous-chantier 3 — D3/D4, plan validé :
 * docs/run-chambres-3.md). Capacité chambre = Σ lits.places, TOUJOURS dérivée
 * au mapping, jamais stockée (D3). Cloisonnement : chambre/lit résolus par
 * (id + centreId) → 404 si autre centre (ne révèle pas l'existence).
 */

// D3 : défauts de places par type quand non fournies.
const PLACES_DEFAUT: Record<string, number> = { SUPERPOSE: 2, DOUBLE: 2 };
const placesEffectives = (type: string, places?: number) =>
  places ?? PLACES_DEFAUT[type] ?? 1;

const LITS_INCLUDE = { lits: { orderBy: { ordre: 'asc' as const } } };

type ChambreAvecLits = {
  id: string;
  centreId: string;
  nom: string;
  etage: string | null;
  ordre: number;
  notes: string | null;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
  lits: Array<{ id: string; type: string; places: number; libelle: string | null; ordre: number }>;
};

@Injectable()
export class ReferentielService {
  constructor(private prisma: PrismaService) {}

  private mapChambre(c: ChambreAvecLits) {
    return {
      id: c.id,
      nom: c.nom,
      etage: c.etage,
      ordre: c.ordre,
      notes: c.notes,
      actif: c.actif,
      capacite: c.lits.reduce((s, l) => s + l.places, 0),
      lits: c.lits.map((l) => ({
        id: l.id,
        type: l.type,
        places: l.places,
        libelle: l.libelle,
        ordre: l.ordre,
      })),
    };
  }

  /** Chambre du centre ou 404 (cloisonnement — ne révèle pas l'existence). */
  private async getChambreDuCentre(chambreId: string, centreId: string) {
    const chambre = await this.prisma.chambre.findFirst({
      where: { id: chambreId, centreId },
      include: LITS_INCLUDE,
    });
    if (!chambre) throw new NotFoundException('Chambre introuvable');
    return chambre;
  }

  /** Lit du centre (via sa chambre) ou 404. */
  private async getLitDuCentre(litId: string, centreId: string) {
    const lit = await this.prisma.lit.findFirst({
      where: { id: litId, chambre: { centreId } },
    });
    if (!lit) throw new NotFoundException('Lit introuvable');
    return lit;
  }

  /** GET /chambres — liste plate triée (étage puis ordre puis nom), groupage côté front (D4). */
  async getChambres(userId: string, centreId?: string | null, inclureInactives = false) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const chambres = await this.prisma.chambre.findMany({
      where: { centreId: centre.id, ...(inclureInactives ? {} : { actif: true }) },
      include: LITS_INCLUDE,
      orderBy: [
        { etage: { sort: 'asc', nulls: 'first' } },
        { ordre: 'asc' },
        { nom: 'asc' },
      ],
    });
    return chambres.map((c) => this.mapChambre(c));
  }

  /** POST /chambres — création, lits inline en une transaction (create imbriqué). */
  async createChambre(dto: CreateChambreDto, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const chambre = await this.prisma.chambre.create({
      data: {
        centreId: centre.id,
        nom: dto.nom,
        etage: dto.etage ?? null,
        ordre: dto.ordre ?? 0,
        notes: dto.notes ?? null,
        ...(dto.lits?.length
          ? {
              lits: {
                create: dto.lits.map((l, i) => ({
                  type: l.type,
                  places: placesEffectives(l.type, l.places),
                  libelle: l.libelle ?? null,
                  ordre: l.ordre ?? i,
                })),
              },
            }
          : {}),
      },
      include: LITS_INCLUDE,
    });
    return this.mapChambre(chambre);
  }

  /** PATCH /chambres/:id — nom/etage/ordre/notes/actif (etage: null = retirer l'étiquette). */
  async updateChambre(
    chambreId: string,
    dto: UpdateChambreDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.getChambreDuCentre(chambreId, centre.id);
    const chambre = await this.prisma.chambre.update({
      where: { id: chambreId },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.etage !== undefined ? { etage: dto.etage } : {}),
        ...(dto.ordre !== undefined ? { ordre: dto.ordre } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
      include: LITS_INCLUDE,
    });
    return this.mapChambre(chambre);
  }

  /**
   * DELETE /chambres/:id — un seul geste, le service choisit (§2 option A du
   * plan) : hard delete si aucune occupation (les lits suivent par cascade),
   * sinon actif=false (le rooming passé est une donnée — §2.3 doc archi).
   * Réponse explicite pour que le front affiche le bon message.
   */
  async deleteChambre(chambreId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.getChambreDuCentre(chambreId, centre.id);

    const occupations = await this.prisma.occupationChambre.count({
      where: { chambreId },
    });
    if (occupations === 0) {
      await this.prisma.chambre.delete({ where: { id: chambreId } });
      return { deleted: true as const };
    }
    await this.prisma.chambre.update({
      where: { id: chambreId },
      data: { actif: false },
    });
    return { deactivated: true as const };
  }

  /** « Chambre 12 » → « Chambre 12 (copie) », « Chambre 12 (copie 2) »… sans collision. */
  private nomCopie(base: string, existants: Set<string>): string {
    let candidat = `${base} (copie)`;
    for (let i = 2; existants.has(candidat); i++) {
      candidat = `${base} (copie ${i})`;
    }
    return candidat;
  }

  /**
   * POST /chambres/:id/dupliquer — copie chambre + TOUS ses lits (le but D3 :
   * matérialiser un étage en un geste), nombre 1–20, suffixe « (copie) » avec
   * anti-collision sur les noms du centre. Transaction : tout ou rien.
   */
  async dupliquerChambre(
    chambreId: string,
    nombre: number,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const source = await this.getChambreDuCentre(chambreId, centre.id);

    const noms = await this.prisma.chambre.findMany({
      where: { centreId: centre.id },
      select: { nom: true },
    });
    const existants = new Set(noms.map((n) => n.nom));

    const copies = await this.prisma.$transaction(
      Array.from({ length: nombre }, () => {
        const nom = this.nomCopie(source.nom, existants);
        existants.add(nom);
        return this.prisma.chambre.create({
          data: {
            centreId: centre.id,
            nom,
            etage: source.etage,
            ordre: source.ordre,
            notes: source.notes,
            lits: {
              create: source.lits.map((l) => ({
                type: l.type,
                places: l.places,
                libelle: l.libelle,
                ordre: l.ordre,
              })),
            },
          },
          include: LITS_INCLUDE,
        });
      }),
    );
    return copies.map((c) => this.mapChambre(c));
  }

  /** POST /chambres/:id/lits — saisie rapide : batch append après l'ordre max existant. */
  async ajouterLits(
    chambreId: string,
    lits: CreateLitDto[],
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const chambre = await this.getChambreDuCentre(chambreId, centre.id);

    const ordreBase = chambre.lits.reduce((max, l) => Math.max(max, l.ordre + 1), 0);
    await this.prisma.lit.createMany({
      data: lits.map((l, i) => ({
        chambreId,
        type: l.type,
        places: placesEffectives(l.type, l.places),
        libelle: l.libelle ?? null,
        ordre: l.ordre ?? ordreBase + i,
      })),
    });
    // Chambre complète re-lue : capacité à jour pour le front en un aller-retour.
    return this.mapChambre(await this.getChambreDuCentre(chambreId, centre.id));
  }

  /** PATCH /chambres/lits/:litId — places jamais re-défaulté au changement de type. */
  async updateLit(litId: string, dto: UpdateLitDto, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.getLitDuCentre(litId, centre.id);
    return this.prisma.lit.update({
      where: { id: litId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.places !== undefined ? { places: dto.places } : {}),
        ...(dto.libelle !== undefined ? { libelle: dto.libelle } : {}),
        ...(dto.ordre !== undefined ? { ordre: dto.ordre } : {}),
      },
    });
  }

  /**
   * DELETE /chambres/lits/:litId — hard direct : les affectations pointant le
   * lit passent à litId=null (FK SetNull), l'affectation chambre survit.
   */
  async deleteLit(litId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.getLitDuCentre(litId, centre.id);
    await this.prisma.lit.delete({ where: { id: litId } });
    return { deleted: true as const };
  }
}
