import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// etiquette/couleur : null explicite = retirer (@IsOptional laisse passer null,
// pattern etage d'UpdateChambreDto). Re-datage/changement de chambre = résolution
// A_REPLACER (D8) : le statut est recalculé, conflit → 409.
export class UpdateOccupationDto {
  @IsOptional() @IsDateString() dateDebut?: string;
  @IsOptional() @IsDateString() dateFin?: string;
  @IsOptional() @IsUUID() chambreId?: string;
  @IsOptional() @IsString() @MaxLength(30) etiquette?: string | null;
  @IsOptional() @IsString() @MaxLength(20) couleur?: string | null;
}
