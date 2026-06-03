import { IsOptional, IsString } from 'class-validator';

export class ClaimCentreDto {
  // UUID d'un centre Liavo OU identifiant externe Éducation Nationale (ex. "92599834").
  @IsString()
  catalogueId!: string;

  @IsOptional()
  @IsString()
  siretExtrait?: string;
}
