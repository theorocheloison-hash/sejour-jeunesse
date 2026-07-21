import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateLitDto } from './create-lit.dto.js';

// Saisie rapide : batch enveloppé { lits: [...] } — le ValidationPipe global ne
// valide pas un tableau top-level (pas de ParseArrayPipe dans le projet ; même
// pattern nested que les DTO devis).
export class AjouterLitsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateLitDto)
  lits!: CreateLitDto[];
}
