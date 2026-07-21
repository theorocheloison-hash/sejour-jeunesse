import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

// Dates optionnelles : défaut = celles du séjour (400 si le séjour n'a pas de
// dates et qu'aucune n'est fournie ; si fournies, les DEUX sont exigées).
export class CreateOccupationsDto {
  @IsUUID() sejourId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  chambreIds!: string[];

  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
}
