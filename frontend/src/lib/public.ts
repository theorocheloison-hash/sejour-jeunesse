const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

export interface CentrePublic {
  id: string;
  nom: string;
  ville: string;
  codePostal: string | null;
  departement: string | null;
  capacite: number | null;
  description: string | null;
  imageUrl: string | null;
  siteWeb: string | null;
  typeSejours: string[];
  thematiquesCentre: string[];
  activitesCentre: string[];
  equipements: string[];
  accessiblePmr: boolean;
  agrementEducationNationale: string | null;
  periodeOuverture: string | null;
  source: string | null;
  apidaeId: string | null;
  // Champs supplémentaires retournés par searchPublic (API EN)
  region?: string;
  capaciteEleves?: number | null;
  capaciteAdultes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  thematiques?: string[];
  activites?: string[];
  accessible?: boolean;
  avisSecurite?: string | null;
}

export interface DemandePubliquePayload {
  prenom: string;
  nom: string;
  email: string;
  typeStructure?: string;
  etablissementNom?: string;
  etablissementVille?: string;
  etablissementUai?: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  niveauClasse?: string;
  thematiquesPedagogiques?: string[];
  typeZone?: string;
  zoneGeographique?: string;
  regionCible?: string;
  villeHebergement?: string;
  centreDestinataireId?: string;
  dateButoireReponse?: string;
  nombreAccompagnateurs?: number;
  heureArrivee?: string;
  heureDepart?: string;
  transportAller?: string;
  transportSurPlace?: boolean;
  activitesSouhaitees?: string;
  budgetMaxParEleve?: number;
  informationsComplementaires?: string;
  ageMin?: number;
  ageMax?: number;
  moinsde6ans?: boolean;
  typeAccueilACM?: string;
  projetEducatif?: string;
  sourceReseau?: string;
  telephone?: string;
}

export async function searchCentresPublics(search: string): Promise<CentrePublic[]> {
  const res = await fetch(
    `${API_BASE}/public/centres?search=${encodeURIComponent(search)}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getCentrePublic(id: string): Promise<CentrePublic | null> {
  const res = await fetch(`${API_BASE}/public/centres/${id}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function soumettreDemandePublique(
  payload: DemandePubliquePayload
): Promise<{ success: boolean; sejourId: string; demandeId: string; centresNotifies: number }> {
  const res = await fetch(`${API_BASE}/public/demande`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Erreur lors de la soumission');
  }
  return res.json();
}
