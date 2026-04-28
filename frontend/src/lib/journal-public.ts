import type { PostJournal } from './collaboration';

export interface JournalPublicData {
  id: string;
  elevePrenom: string;
  eleveNom: string;
  sejour: {
    id: string;
    titre: string;
    lieu: string;
    dateDebut: string;
    dateFin: string;
    description: string | null;
    niveauClasse: string | null;
    placesTotales: number;
    hebergements: Array<{
      nom: string;
      ville: string;
      adresse: string | null;
      telephone: string | null;
    }>;
    postsJournal: PostJournal[];
    planningActivites: Array<{
      id: string;
      date: string;
      heureDebut: string;
      heureFin: string;
      titre: string;
      couleur: string | null;
      estCollective: boolean;
    }>;
  };
}

export async function getJournalPublic(token: string): Promise<JournalPublicData> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/journal-public/${token}`);
  if (!res.ok) throw new Error('Journal introuvable');
  return res.json();
}
