import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDemandeDto {
  @IsString()
  @MinLength(1)
  titre: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  moisSouhaite?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  anneeSouhaitee?: number;

  @IsOptional()
  @IsString()
  noteDateFlexible?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dureeNuits?: number;

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
  @IsArray()
  @IsString({ each: true })
  departementsCibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  typePension?: string[];

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
  @IsString()
  informationsComplementaires?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;

  @IsOptional()
  @IsUUID()
  centreDestinataireId?: string;
}
