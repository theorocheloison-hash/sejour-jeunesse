import api from './api';

/**
 * Client des endpoints "refonte inscriptions" (Lots 3 + 4a, dormants jusqu'ici) :
 * snapshot figé du séjour (ouverture des inscriptions) + bibliothèque de modèles
 * du centre actif (X-Centre-Id posé par l'interceptor api).
 * Les erreurs (400 garde-fou retrait, 409 nom de modèle pris) sont propagées
 * à l'appelant pour affichage du message serveur.
 */

export interface ModeleInscription {
  id: string;
  nom: string;
  champsActifs: string[];
}

/** PATCH /sejours/:id/champs-inscription — 1ʳᵉ écriture = ouverture (B1). */
export async function updateChampsInscriptionSejour(
  sejourId: string,
  champsActifs: string[],
): Promise<{ champsInscription: { champsActifs: string[] } }> {
  const { data } = await api.patch(`/sejours/${sejourId}/champs-inscription`, { champsActifs });
  return data;
}

/** PATCH /sejours/:id/responsable-inscriptions — B4 « qui tient la main » sur un
 * séjour collaboratif (hébergeur). Erreurs serveur (400) propagées à l'appelant. */
export async function updateResponsableInscriptions(
  sejourId: string,
  responsable: 'ORGANISATEUR' | 'HEBERGEUR',
): Promise<{ responsableInscriptions: 'ORGANISATEUR' | 'HEBERGEUR' }> {
  const { data } = await api.patch(`/sejours/${sejourId}/responsable-inscriptions`, { responsable });
  return data;
}

/** GET /sejours/:id/champs-inscription/verrouilles — clés Bloc B déjà remplies
 * par ≥1 inscrit (grisage de l'écran d'ouverture, Lot 5c-B). */
export async function getChampsVerrouillesSejour(sejourId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/sejours/${sejourId}/champs-inscription/verrouilles`);
  return data;
}

/** GET /centres/modeles-inscription — modèles du centre actif. */
export async function listModelesInscription(): Promise<ModeleInscription[]> {
  const { data } = await api.get<ModeleInscription[]>('/centres/modeles-inscription');
  return data;
}

/** POST /centres/modeles-inscription — créer un modèle (409 si nom déjà pris). */
export async function createModeleInscription(
  nom: string,
  champsActifs: string[],
): Promise<ModeleInscription> {
  const { data } = await api.post<ModeleInscription>('/centres/modeles-inscription', {
    nom,
    champsActifs,
  });
  return data;
}
