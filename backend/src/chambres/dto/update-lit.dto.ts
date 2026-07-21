import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TYPES_LIT, type TypeLit } from './create-lit.dto.js';

// places n'est PAS re-défaulté au changement de type : une valeur existante
// n'est modifiée que si elle est explicitement fournie.
export class UpdateLitDto {
  @IsOptional() @IsIn(TYPES_LIT) type?: TypeLit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6, { message: 'un lit ne peut excéder 6 places — pour un dortoir, créez plusieurs lits' })
  places?: number;

  @IsOptional() @IsString() @MaxLength(50) libelle?: string | null;
  @IsOptional() @IsInt() ordre?: number;
}
