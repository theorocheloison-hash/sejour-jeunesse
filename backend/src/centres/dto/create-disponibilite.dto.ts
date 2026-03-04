import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDisponibiliteDto {
  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  capaciteDisponible: number;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
