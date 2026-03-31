import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchHebergementDto } from './dto/search-hebergement.dto.js';

const API_BASE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ApiRecord {
  identifiant: string;
  nom_de_la_structure_d_accueil_et_d_hebergement_fr: string;
  nom_du_lieu_d_accueil_ville: string;
  nom_du_lieu_d_accueil_departement: string;
  nom_du_lieu_d_accueil_region: string;
  nom_du_lieu_d_accueil_code_postal: string;
  nom_du_lieu_d_accueil_latitude: number | null;
  nom_du_lieu_d_accueil_longitude: number | null;
  nombre_de_lits_pour_les_eleves: number | null;
  nombre_de_lits_pour_les_adultes_assurant_l_encadrement: number | null;
  description_longue: string | null;
  image: string | null;
  permalien: string | null;
  outils_d_inscription: string | null;
  thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement: string[] | null;
  activites_proposees_par_la_structure_d_accueil_et_d_hebergement: string[] | null;
  accessibilite_de_la_structure_d_accueil_et_d_hebergement_aux_eleves_en_situation_de_handicap: string | null;
  avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite: string | null;
  periode_d_ouverture_annuelle_de_la_structure_pour_l_accueil_des_eleves_dans_le_cadre_de_voyages_scol: string | null;
}

interface ApiResponse {
  total_count: number;
  results: ApiRecord[];
}

function mapRecord(r: ApiRecord) {
  return {
    id: r.identifiant,
    nom: r.nom_de_la_structure_d_accueil_et_d_hebergement_fr,
    ville: r.nom_du_lieu_d_accueil_ville,
    departement: r.nom_du_lieu_d_accueil_departement,
    region: r.nom_du_lieu_d_accueil_region,
    codePostal: r.nom_du_lieu_d_accueil_code_postal,
    latitude: r.nom_du_lieu_d_accueil_latitude,
    longitude: r.nom_du_lieu_d_accueil_longitude,
    capaciteEleves: r.nombre_de_lits_pour_les_eleves,
    capaciteAdultes: r.nombre_de_lits_pour_les_adultes_assurant_l_encadrement,
    description: r.description_longue,
    image: r.image,
    permalien: r.permalien,
    contact: r.outils_d_inscription,
    thematiques: r.thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement ?? [],
    activites: r.activites_proposees_par_la_structure_d_accueil_et_d_hebergement ?? [],
    accessible: r.accessibilite_de_la_structure_d_accueil_et_d_hebergement_aux_eleves_en_situation_de_handicap === 'Oui',
    avisSecurite: r.avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite,
    periodeOuverture: r.periode_d_ouverture_annuelle_de_la_structure_pour_l_accueil_des_eleves_dans_le_cadre_de_voyages_scol,
  };
}

function mapCentre(c: any) {
  return {
    id: c.id,
    nom: c.nom,
    ville: c.ville,
    departement: c.departement ?? '',
    region: (() => {
      const d = (c.departement ?? '').toLowerCase();
      if (['haute-savoie','savoie','ain','allier','ardèche','cantal','drôme','isère','loire','haute-loire','puy-de-dôme','rhône'].some(x => d.includes(x))) return 'Auvergne-Rhône-Alpes';
      if (['côte-d\'or','doubs','jura','nièvre','haute-saône','saône-et-loire','yonne','territoire de belfort'].some(x => d.includes(x))) return 'Bourgogne-Franche-Comté';
      if (['côtes-d\'armor','finistère','ille-et-vilaine','morbihan'].some(x => d.includes(x))) return 'Bretagne';
      if (['cher','eure-et-loir','indre','indre-et-loire','loir-et-cher','loiret'].some(x => d.includes(x))) return 'Centre-Val de Loire';
      if (['corse'].some(x => d.includes(x))) return 'Corse';
      if (['bas-rhin','haut-rhin','moselle','meurthe-et-moselle','meuse','vosges','ardennes','aube','marne','haute-marne'].some(x => d.includes(x))) return 'Grand Est';
      if (['aisne','nord','oise','pas-de-calais','somme'].some(x => d.includes(x))) return 'Hauts-de-France';
      if (['paris','seine-et-marne','yvelines','essonne','hauts-de-seine','seine-saint-denis','val-de-marne','val-d\'oise'].some(x => d.includes(x))) return 'Île-de-France';
      if (['calvados','eure','manche','orne','seine-maritime'].some(x => d.includes(x))) return 'Normandie';
      if (['charente','charente-maritime','corrèze','creuse','dordogne','gironde','landes','lot-et-garonne','pyrénées-atlantiques','deux-sèvres','vienne','haute-vienne'].some(x => d.includes(x))) return 'Nouvelle-Aquitaine';
      if (['ariège','aveyron','haute-garonne','gers','lot','hautes-pyrénées','pyrénées-orientales','tarn','tarn-et-garonne','hérault','gard','lozère'].some(x => d.includes(x))) return 'Occitanie';
      if (['loire-atlantique','maine-et-loire','mayenne','sarthe','vendée'].some(x => d.includes(x))) return 'Pays de la Loire';
      if (['alpes-de-haute-provence','hautes-alpes','alpes-maritimes','bouches-du-rhône','var','vaucluse'].some(x => d.includes(x))) return 'Provence-Alpes-Côte d\'Azur';
      return '';
    })(),
    codePostal: c.codePostal,
    latitude: null,
    longitude: null,
    capaciteEleves: c.capacite,
    capaciteAdultes: c.capaciteAdultes ?? null,
    description: c.description,
    image: c.imageUrl ?? null,
    permalien: null,
    contact: c.telephone ?? c.email ?? null,
    thematiques: c.thematiquesCentre ?? [],
    activites: c.activitesCentre ?? [],
    accessible: c.accessiblePmr ?? false,
    avisSecurite: c.avisSecurite ?? null,
    periodeOuverture: c.periodeOuverture ?? null,
  };
}

@Injectable()
export class HebergementService {
  constructor(private prisma: PrismaService) {}

  async search(dto: SearchHebergementDto) {
    // ── Requête API Éducation Nationale ──────────────────────────────────
    const clauses: string[] = [];

    if (dto.nom) {
      clauses.push(`search(nom_de_la_structure_d_accueil_et_d_hebergement_fr,"${dto.nom}")`);
    }
    if (dto.ville) {
      clauses.push(`search(nom_du_lieu_d_accueil_ville,"${dto.ville}")`);
    }
    if (dto.departement) {
      clauses.push(`search(nom_du_lieu_d_accueil_departement,"${dto.departement}")`);
    }
    if (dto.region) {
      clauses.push(`search(nom_du_lieu_d_accueil_region,"${dto.region}")`);
    }

    const params = new URLSearchParams({ limit: '50' });
    if (clauses.length > 0) {
      params.set('where', clauses.join(' AND '));
    }

    const apiPromise = fetch(`${API_BASE}?${params}`).then((r) => r.json()) as Promise<ApiResponse>;

    // ── Requête Prisma (centres Liavo ACTIVE) ───────────────────────────
    const where: any = { statut: 'ACTIVE' };
    const andClauses: any[] = [];

    if (dto.nom) {
      andClauses.push({
        OR: [
          { nom: { contains: dto.nom, mode: 'insensitive' } },
          { ville: { contains: dto.nom, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.ville) {
      andClauses.push({
        OR: [
          { ville: { contains: dto.ville, mode: 'insensitive' } },
          { nom: { contains: dto.ville, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.departement) {
      andClauses.push({ departement: { contains: dto.departement, mode: 'insensitive' } });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const prismaPromise = this.prisma.centreHebergement.findMany({ where, take: 50 });
    const prismaCountPromise = this.prisma.centreHebergement.count({ where });

    // ── Exécution parallèle ─────────────────────────────────────────────
    const [apiData, centres, centresCount] = await Promise.all([
      apiPromise,
      prismaPromise,
      prismaCountPromise,
    ]);

    const liavoResults = centres.map(mapCentre);
    const enResults = apiData.results.map(mapRecord);

    const liavoBas = new Set(liavoResults.map(r => r.nom.toLowerCase().trim()));
    const enFiltered = enResults.filter(
      r => !liavoBas.has(r.nom.toLowerCase().trim())
    );

    return {
      total: centresCount + (apiData.total_count - (enResults.length - enFiltered.length)),
      results: [...liavoResults, ...enFiltered],
    };
  }

  async findById(id: string) {
    if (UUID_RE.test(id)) {
      const centre = await this.prisma.centreHebergement.findFirst({
        where: { id, statut: 'ACTIVE' },
      });
      if (centre) return mapCentre(centre);
      throw new NotFoundException('Hébergement introuvable');
    }

    const params = new URLSearchParams({
      limit: '1',
      where: `identifiant="${id}"`,
    });

    const res = await fetch(`${API_BASE}?${params}`);
    const data: ApiResponse = await res.json();

    if (!data.results.length) {
      throw new NotFoundException('Hébergement introuvable');
    }

    return mapRecord(data.results[0]);
  }
}
