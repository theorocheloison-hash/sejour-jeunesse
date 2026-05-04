export enum Role {
  ORGANISATEUR = 'ORGANISATEUR',
  SIGNATAIRE = 'SIGNATAIRE',
  AUTORITE = 'AUTORITE',
  PARENT = 'PARENT',
  HEBERGEUR = 'HEBERGEUR',
  ADMIN = 'ADMIN',
  RESEAU = 'RESEAU',
}

export interface OrganisationResume {
  id: string;
  nom: string;
  uai: string | null;
  siren: string | null;
  typeStructure: string | null;
  ville: string | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organisation?: OrganisationResume | null;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
