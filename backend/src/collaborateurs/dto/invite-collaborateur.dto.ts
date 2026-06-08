import { IsArray, IsEmail, IsObject, IsString } from 'class-validator';

export class InviteCollaborateurDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @IsString({ each: true })
  centreIds!: string[];

  @IsObject()
  permissions!: {
    planning: 'NONE' | 'READ' | 'WRITE';
    sejours: 'NONE' | 'READ' | 'WRITE';
    devis: 'NONE' | 'READ' | 'WRITE';
    crm: 'NONE' | 'READ' | 'WRITE';
    facturation: 'NONE' | 'READ' | 'WRITE';
    parametres: 'NONE' | 'READ' | 'WRITE';
  };
}
