export enum Role {
  TEACHER = 'TEACHER',
  DIRECTOR = 'DIRECTOR',
  ACCOUNTANT = 'ACCOUNTANT',
  RECTOR = 'RECTOR',
  PARENT = 'PARENT',
  VENUE = 'VENUE',
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
