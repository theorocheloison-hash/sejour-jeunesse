import { Injectable, Logger } from '@nestjs/common';

const API_BASE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';
const FIELDS = 'identifiant_de_l_etablissement,nom_etablissement,type_etablissement,libelle_nature,adresse_1,code_postal,nom_commune,mail,telephone,libelle_academie';

export interface EtablissementResult {
  uai: string;
  nom: string;
  type: string;
  nature: string;
  adresse: string;
  codePostal: string;
  commune: string;
  mail: string | null;
  telephone: string | null;
  academie: string;
}

@Injectable()
export class EtablissementsService {
  private readonly logger = new Logger(EtablissementsService.name);

  async rechercher(query?: string, codePostal?: string): Promise<EtablissementResult[]> {
    const whereParts: string[] = [];

    if (query && query.length >= 2) {
      const escaped = query.replace(/"/g, '\\"');
      whereParts.push(`search(nom_etablissement, "${escaped}")`);
    }

    if (codePostal) {
      whereParts.push(`code_postal="${codePostal}"`);
    }

    if (whereParts.length === 0) return [];

    const where = whereParts.join(' AND ');
    const url = `${API_BASE}?select=${FIELDS}&where=${encodeURIComponent(where)}&limit=15&order_by=nom_etablissement`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`API Education: ${res.status} ${res.statusText}`);
        return [];
      }
      const data = await res.json();
      return (data.results ?? []).map(this.mapRecord);
    } catch (err) {
      this.logger.error('Erreur API Education Nationale', err);
      return [];
    }
  }

  async getById(uai: string): Promise<EtablissementResult | null> {
    const where = `identifiant_de_l_etablissement="${uai}"`;
    const url = `${API_BASE}?select=${FIELDS}&where=${encodeURIComponent(where)}&limit=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.results || data.results.length === 0) return null;
      return this.mapRecord(data.results[0]);
    } catch {
      return null;
    }
  }

  private mapRecord(r: any): EtablissementResult {
    return {
      uai: r.identifiant_de_l_etablissement ?? '',
      nom: r.nom_etablissement ?? '',
      type: r.type_etablissement ?? '',
      nature: r.libelle_nature ?? '',
      adresse: r.adresse_1 ?? '',
      codePostal: r.code_postal ?? '',
      commune: r.nom_commune ?? '',
      mail: r.mail ?? null,
      telephone: r.telephone ?? null,
      academie: r.libelle_academie ?? '',
    };
  }
}
