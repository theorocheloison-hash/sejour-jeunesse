import api from '@/src/lib/api';

// Module chambres — étage 1 : alertes de capacité globale (D9/D10).
// Contrat : backend/src/chambres/capacite.controller.ts. X-Centre-Id est posé
// par l'intercepteur de `api` (centre actif) — jamais de fetch direct.

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AlerteCapacite {
  sejourId: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  effectif: number;
  maxOccupationSignee: number;
  deficit: number;
  etat: 'ACTIVE' | 'ACQUITTEE';
  capaciteAlerteAcquitteeAt: string | null;
}

// Extension 21/07 : fenêtre où les seuls séjours SIGNÉS dépassent la capacité.
// Non acquittable — elle ne se tait que quand la surcapacité disparaît.
export interface SurEngagement {
  dateDebut: string;
  dateFin: string; // EXCLUSIVE — [debut, fin), afficher la veille
  pic: number;
  deficit: number;
  sejours: Array<{ id: string; titre: string }>;
}

export interface AlertesCapaciteResponse {
  capacite: number;
  alertes: AlerteCapacite[];
  // Optionnel : rétrocompatible avec un backend qui ne le renvoie pas encore.
  surEngagements?: SurEngagement[];
}

// ─── Fonctions API ───────────────────────────────────────────────────────────

export async function getAlertesCapacite(): Promise<AlertesCapaciteResponse> {
  const r = await api.get('/chambres/alertes-capacite');
  return r.data;
}

export async function acquitterAlerteCapacite(
  sejourId: string,
): Promise<{ sejourId: string; capaciteAlerteAcquitteeAt: string; etat: 'ACQUITTEE' }> {
  const r = await api.patch(`/chambres/alertes-capacite/${sejourId}/acquitter`);
  return r.data;
}

// ─── Référentiel chambres/lits (sous-chantier 5) ────────────────────────────
// Contrat : backend/src/chambres/referentiel.controller.ts. capacite est
// dérivée serveur (Σ lits.places), jamais calculée ici.

export type TypeLit = 'SIMPLE' | 'SUPERPOSE' | 'TIROIR' | 'DOUBLE' | 'BB' | 'APPOINT';

export interface Lit {
  id: string;
  type: TypeLit;
  places: number;
  libelle: string | null;
  ordre: number;
}

export interface Chambre {
  id: string;
  nom: string;
  etage: string | null;
  ordre: number;
  notes: string | null;
  equipements: string[];
  actif: boolean;
  capacite: number;
  lits: Lit[];
}

export interface CreateLitInput {
  type: TypeLit;
  places?: number; // défauts serveur : SUPERPOSE/DOUBLE → 2, sinon 1
  libelle?: string;
  ordre?: number;
}

export interface CreateChambreInput {
  nom: string;
  etage?: string;
  ordre?: number; // omis en pratique : le serveur attribue max(centre)+1 (run 5.1)
  notes?: string;
  equipements?: string[];
  lits?: CreateLitInput[];
}

export interface UpdateChambreInput {
  nom?: string;
  etage?: string | null;
  ordre?: number;
  notes?: string | null;
  equipements?: string[]; // liste COMPLÈTE recalculée (sémantique set côté serveur)
  actif?: boolean;
}

export interface UpdateLitInput {
  type?: TypeLit;
  places?: number;
  libelle?: string | null;
  ordre?: number;
}

// DELETE : hard si zéro occupation, désactivation sinon — deux messages distincts.
export type DeleteChambreResult = { deleted?: boolean; deactivated?: boolean };

export async function getChambres(inactives = false): Promise<Chambre[]> {
  const r = await api.get(`/chambres${inactives ? '?inactives=1' : ''}`);
  return r.data;
}

export async function createChambre(input: CreateChambreInput): Promise<Chambre> {
  const r = await api.post('/chambres', input);
  return r.data;
}

export async function updateChambre(id: string, input: UpdateChambreInput): Promise<Chambre> {
  const r = await api.patch(`/chambres/${id}`, input);
  return r.data;
}

export async function deleteChambre(id: string): Promise<DeleteChambreResult> {
  const r = await api.delete(`/chambres/${id}`);
  return r.data;
}

export async function dupliquerChambre(id: string, nombre = 1): Promise<Chambre[]> {
  const r = await api.post(`/chambres/${id}/dupliquer`, { nombre });
  return r.data;
}

// ⚠️ Batch enveloppé { lits: [...] } — jamais un tableau racine.
export async function ajouterLits(chambreId: string, lits: CreateLitInput[]): Promise<Chambre> {
  const r = await api.post(`/chambres/${chambreId}/lits`, { lits });
  return r.data;
}

export async function updateLit(litId: string, input: UpdateLitInput): Promise<Lit> {
  const r = await api.patch(`/chambres/lits/${litId}`, input);
  return r.data;
}

export async function deleteLit(litId: string): Promise<{ deleted: boolean }> {
  const r = await api.delete(`/chambres/lits/${litId}`);
  return r.data;
}
