import { IsBoolean, IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';

// etage et ordre sont modifiables : l'ordre physique des chambres dans l'étage
// est une donnée de premier rang (le plan se rend spatialement, jamais en liste
// plate). etage: null explicite = retirer l'étiquette (@IsOptional laisse passer null).
export class UpdateChambreDto {
  @IsOptional() @IsString() @Length(1, 100) nom?: string;
  @IsOptional() @IsString() @MaxLength(50) etage?: string | null;
  @IsOptional() @IsInt() ordre?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsBoolean() actif?: boolean;
}
