import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SearchOrganisationsDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(2, { message: 'La recherche doit contenir au moins 2 caractères' })
  @MaxLength(100, { message: 'La recherche est trop longue (max 100 caractères)' })
  q: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'Code postal invalide (5 chiffres attendus)' })
  cp?: string;
}
