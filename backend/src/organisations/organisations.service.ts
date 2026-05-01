import { Injectable, Logger } from '@nestjs/common';
import { SourceOrganisation, TypeStructure } from '@prisma/client';

export interface OrganisationSearchResult {
  siren: string | null;
  siret: string | null;
  nom: string;
  raisonSociale: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  departement: string | null;
  typeStructure: TypeStructure | null;
  source: SourceOrganisation;
}

interface CacheEntry {
  data: OrganisationSearchResult[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const API_URL = 'https://recherche-entreprises.api.gouv.fr/search';
const PER_PAGE = 10;

/**
 * Mappe un code "nature_juridique" (INSEE) vers TypeStructure LIAVO.
 * Retourne null si on ne peut pas conclure (l'utilisateur choisira).
 *
 * Référence : nomenclature INSEE catégories juridiques niveau III/IV.
 */
export function mapperNatureJuridique(
  natureJuridique: string | null | undefined,
): TypeStructure | null {
  if (!natureJuridique) return null;
  const code = natureJuridique.trim();

  if (code === '1000') return TypeStructure.MICRO_ENTREPRISE;
  if (code === '7210') return TypeStructure.MAIRIE;
  if (code === '7220' || code === '7230') return TypeStructure.COLLECTIVITE_TERRITORIALE;
  if (code === '7383' || code === '7384') return TypeStructure.COLLEGE_LYCEE;
  if (code.startsWith('92')) return TypeStructure.ASSOCIATION;
  if (code.startsWith('5')) return TypeStructure.ENTREPRISE;

  return null;
}

function calculerDepartement(codePostal: string | null | undefined): string | null {
  if (!codePostal) return null;
  if (codePostal.startsWith('97') || codePostal.startsWith('98')) {
    return codePostal.slice(0, 3);
  }
  return codePostal.slice(0, 2);
}

function normaliserCle(q: string): string {
  return q.toLowerCase().normalize('NFKD');
}

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger(OrganisationsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Recherche une organisation via l'API recherche-entreprises.api.gouv.fr.
   * - Cache mémoire 5min par clé normalisée.
   * - Timeout réseau 3s (AbortController).
   * - Aucune erreur ne remonte au client : retourne [] en cas d'échec.
   */
  async searchExternal(q: string): Promise<OrganisationSearchResult[]> {
    const cacheKey = normaliserCle(q);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const url = `${API_URL}?q=${encodeURIComponent(q)}&page=1&per_page=${PER_PAGE}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`API gouv non-2xx: ${res.status} pour q="${q}"`);
        return [];
      }
      const data = await res.json();
      const results = this.mapResults(data?.results ?? []);
      this.cache.set(cacheKey, {
        data: results,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return results;
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'unknown';
      this.logger.warn(`API gouv échec (${reason}) pour q="${q}"`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapResults(rawResults: any[]): OrganisationSearchResult[] {
    const results: OrganisationSearchResult[] = [];
    for (const etab of rawResults) {
      const siege = etab?.siege ?? null;
      const etat = siege?.etat_administratif ?? etab?.etat_administratif;
      if (etat && etat !== 'A') continue;

      const codePostal: string | null = siege?.code_postal ?? null;
      const siret: string | null = siege?.siret ?? null;
      const siren: string | null = etab?.siren ?? (siret ? siret.slice(0, 9) : null);

      results.push({
        siren,
        siret,
        nom: etab?.nom_complet ?? etab?.nom_raison_sociale ?? '',
        raisonSociale: etab?.nom_raison_sociale ?? null,
        adresse: siege?.geo_adresse ?? siege?.adresse ?? null,
        codePostal,
        ville: siege?.libelle_commune ?? null,
        departement: calculerDepartement(codePostal),
        typeStructure: mapperNatureJuridique(etab?.nature_juridique),
        source: SourceOrganisation.API_SIRENE,
      });
    }
    return results;
  }
}
