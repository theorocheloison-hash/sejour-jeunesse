import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

// Blocage manuel (D11) : FERME d'office, sejourId NULL. motif requis au DTO
// (un blocage sans motif est illisible sur la grille), colonne nullable en base.
export class CreateBlocagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  chambreIds!: string[];

  @IsDateString() dateDebut!: string;
  @IsDateString() dateFin!: string;
  @IsString() @Length(1, 255) motif!: string;
}
