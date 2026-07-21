import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DupliquerChambreDto {
  // 1–20 copies en un geste (matérialiser un étage entier — D3).
  @IsOptional() @IsInt() @Min(1) @Max(20) nombre?: number;
}
