import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Ligne révisée fournie à l'émission d'une facture (modèle B : le devis signé est
 * immuable, l'ajustement se fait ici). Mêmes champs que LigneDevisDto, sans
 * produitCatalogueId (LigneFacture n'en porte pas).
 */
export class LigneEmissionFactureDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  quantite!: number;

  @IsNumber()
  prixUnitaire!: number;

  @IsNumber()
  @IsOptional()
  tva?: number;

  @IsNumber()
  totalHT!: number;

  @IsNumber()
  totalTTC!: number;
}

/** Body des 3 émissions (acompte/solde/total). Sans `lignes`, snapshot du devis (rétrocompat). */
export class EmettreFactureDto {
  @IsUUID()
  devisId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneEmissionFactureDto)
  lignes?: LigneEmissionFactureDto[];
}
