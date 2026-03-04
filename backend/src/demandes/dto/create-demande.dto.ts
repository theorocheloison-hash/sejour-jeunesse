import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDemandeDto {
  @IsString()
  @MinLength(1)
  titre: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  nombreEleves: number;

  @IsString()
  @MinLength(1)
  villeHebergement: string;

  @IsOptional()
  @IsString()
  regionCible?: string;

  @IsOptional()
  @IsDateString()
  dateButoireReponse?: string;

  @IsUUID()
  sejourId: string;
}
