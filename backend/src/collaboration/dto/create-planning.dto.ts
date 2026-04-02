import { IsString, IsNotEmpty, IsOptional, Matches, IsDateString } from 'class-validator';

export class CreatePlanningDto {
  @IsDateString()
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:MM attendu' })
  heureDebut!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:MM attendu' })
  heureFin!: string;

  @IsString()
  @IsNotEmpty()
  titre!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  responsable?: string;

  @IsString()
  @IsOptional()
  couleur?: string;
}
