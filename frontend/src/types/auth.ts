export enum Role {
  ORGANISATEUR = 'ORGANISATEUR',
  SIGNATAIRE = 'SIGNATAIRE',
  AUTORITE = 'AUTORITE',
  PARENT = 'PARENT',
  HEBERGEUR = 'HEBERGEUR',
  ADMIN = 'ADMIN',
  RESEAU = 'RESEAU',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
