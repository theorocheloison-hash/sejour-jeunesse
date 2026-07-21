import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const TYPES_LIT = ['SIMPLE', 'SUPERPOSE', 'TIROIR', 'DOUBLE', 'BB', 'APPOINT'] as const;
export type TypeLit = (typeof TYPES_LIT)[number];

// D3 : places optionnel — défaut par type côté service (SUPERPOSE/DOUBLE → 2, sinon 1).
export class CreateLitDto {
  @IsIn(TYPES_LIT)
  type!: TypeLit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6, { message: 'un lit ne peut excéder 6 places — pour un dortoir, créez plusieurs lits' })
  places?: number;

  @IsOptional() @IsString() @MaxLength(50) libelle?: string;
  @IsOptional() @IsInt() ordre?: number;
}
