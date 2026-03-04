import { Injectable, NotFoundException } from '@nestjs/common';
import { SearchHebergementDto } from './dto/search-hebergement.dto.js';

const API_BASE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

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

@Injectable()
export class HebergementService {
  async search(dto: SearchHebergementDto) {
    const clauses: string[] = [];

    if (dto.ville) {
      clauses.push(`search(nom_du_lieu_d_accueil_ville,"${dto.ville}")`);
    }
    if (dto.region) {
      clauses.push(`search(nom_du_lieu_d_accueil_region,"${dto.region}")`);
    }
    if (dto.capaciteMin != null) {
      clauses.push(`nombre_de_lits_pour_les_eleves>=${dto.capaciteMin}`);
    }
    if (dto.capaciteMax != null) {
      clauses.push(`nombre_de_lits_pour_les_eleves<=${dto.capaciteMax}`);
    }

    const params = new URLSearchParams({ limit: '50' });
    if (clauses.length > 0) {
      params.set('where', clauses.join(' AND '));
    }

    const res = await fetch(`${API_BASE}?${params}`);
    const data: ApiResponse = await res.json();

    return {
      total: data.total_count,
      results: data.results.map(mapRecord),
    };
  }

  async findById(id: string) {
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
