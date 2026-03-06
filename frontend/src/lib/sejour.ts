import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutSejour = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVENTION';
export type AppelOffreStatut = 'BROUILLON' | 'OUVERT' | 'FERME';
export type TypeZone = 'FRANCE' | 'REGION' | 'DEPARTEMENT' | 'VILLE';

export interface CreateSejourDto {
  titre: string;
  informationsComplementaires?: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  niveauClasse: string;
  thematiquesPedagogiques: string[];
  typeZone: TypeZone;
  zoneGeographique: string;
  dateButoireDevis?: string;
}

export interface DevisSelectionne {
  id: string;
  statut: string;
  montantTotal: string;
  montantTTC: number | null;
  typeDocument: string;
  estFacture: boolean;
  numeroFacture: string | null;
  montantAcompte: number | null;
  pourcentageAcompte: number | null;
  centre?: { nom: string };
}

export interface SejourDemande {
  id: string;
  _count: { devis: number };
  devis?: DevisSelectionne[];
}

export interface Sejour {
  id: string;
  titre: string;
  informationsComplementaires?: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  placesRestantes: number;
  prix: number;
  statut: StatutSejour;
  niveauClasse: string | null;
  thematiquesPedagogiques: string[];
  typeZone: TypeZone | null;
  zoneGeographique: string | null;
  dateButoireDevis: string | null;
  dateLimiteInscription: string | null;
  appelOffreStatut: AppelOffreStatut;
  demandes?: SejourDemande[];
}

export interface SejourDirecteur extends Sejour {
  createur: { prenom: string; nom: string } | null;
}

export interface AccompagnateurResume {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  signeeAt: string | null;
  signatureNom: string | null;
  moyenTransport: string | null;
  createdAt: string;
}

export interface AutorisationResume {
  id: string;
  elevePrenom: string;
  eleveNom: string;
  parentEmail: string;
  signeeAt: string | null;
  paiementStatut?: string | null;
}

export interface SejourDetail extends Omit<Sejour, 'demandes'> {
  createur: {
    prenom: string; nom: string; email: string; telephone: string | null;
    etablissementNom: string | null; etablissementAdresse: string | null;
    etablissementVille: string | null; etablissementUai: string | null;
    etablissementEmail: string | null; etablissementTelephone: string | null;
  } | null;
  accompagnateurs: AccompagnateurResume[];
  autorisations: AutorisationResume[];
  demandes?: Array<{
    id: string;
    devis: Array<{
      id: string;
      montantTotal: string;
      montantParEleve: string;
      statut: string;
      description: string | null;
      documentUrl: string | null;
      typeDevis: string | null;
      lignes?: Array<{
        description: string;
        quantite: number;
        prixUnitaire: number;
        tva: number;
        totalHT: number;
        totalTTC: number;
      }>;
      centre?: { id: string; nom: string; ville: string; email: string | null; telephone: string | null };
    }>;
  }>;
  hebergements?: Array<{ nom: string; adresse: string | null; ville: string | null }>;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function createSejour(dto: CreateSejourDto): Promise<Sejour> {
  const { data } = await api.post<Sejour>('/sejours', dto);
  return data;
}

export async function getMesSejours(): Promise<Sejour[]> {
  const { data } = await api.get<Sejour[]>('/sejours/me');
  return data;
}

export async function getAllSejours(): Promise<SejourDirecteur[]> {
  const { data } = await api.get<SejourDirecteur[]>('/sejours');
  return data;
}

export async function getSejourDetail(id: string): Promise<SejourDetail> {
  const { data } = await api.get<SejourDetail>(`/sejours/${id}/detail`);
  return data;
}

export async function updateSejourStatus(id: string, statut: StatutSejour): Promise<Sejour> {
  const { data } = await api.patch<Sejour>(`/sejours/${id}/status`, { statut });
  return data;
}

export async function updateSejour(
  id: string,
  dto: { prix?: number; dateLimiteInscription?: string },
): Promise<Sejour> {
  const { data } = await api.patch<Sejour>(`/sejours/${id}`, dto);
  return data;
}
