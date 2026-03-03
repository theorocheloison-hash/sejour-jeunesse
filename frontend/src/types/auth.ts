export interface User {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
