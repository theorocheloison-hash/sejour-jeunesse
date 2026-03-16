import api from '@/src/lib/api';

export interface InvitationCollaboration {
  id: string;
  token: string;
  emailEnseignant: string;
  titreSejourSuggere: string;
  dateDebut: string;
  dateFin: string;
  nbElevesEstime: number;
  message: string | null;
  acceptedAt: string | null;
  centre: {
    nom: string;
    ville: string;
    adresse: string;
  };
}

export async function getInvitation(token: string): Promise<InvitationCollaboration> {
  const { data } = await api.get<InvitationCollaboration>(`/invitation-collaboration/${token}`);
  return data;
}

export async function accepterInvitation(token: string): Promise<{ sejourId: string }> {
  const { data } = await api.post<{ sejourId: string }>(`/invitation-collaboration/${token}/accepter`);
  return data;
}
