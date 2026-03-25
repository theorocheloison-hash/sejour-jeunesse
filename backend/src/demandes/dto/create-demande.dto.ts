import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
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

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  nombreAccompagnateurs?: number;

  @IsOptional()
  @IsString()
  heureArrivee?: string;

  @IsOptional()
  @IsString()
  heureDepart?: string;

  @IsOptional()
  @IsString()
  transportAller?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  transportSurPlace?: boolean;

  @IsOptional()
  @IsString()
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;

  @IsOptional()
  @IsUUID()
  centreDestinataireId?: string;
}
