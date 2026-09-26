import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ── Sémantique du PATCH profil (lot A) ───────────────────────────────────────
// absent (undefined) → champ non modifié ; null → effacement (champs EFFAÇABLES
// uniquement) ; '' après trim sur un texte EFFAÇABLE → converti en null.
// Champ OBLIGATOIRE (colonne non nullable) : s'il est présent, il doit être
// valide et non vide — null ou '' → 400 avec un message français nommant le
// champ, jamais un 500 Prisma.

// Texte OBLIGATOIRE : trim seul ('' reste '' → rejeté par IsNotEmpty).
const trimTexte = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Texte EFFAÇABLE : trim, et '' devient null (effacement explicite).
const videVersNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class UpdateCentreDto {
  @ValidateIf((o) => o.nom !== undefined)
  @Transform(trimTexte)
  @IsString({ message: 'Le nom du centre ne peut pas être vide.' })
  @IsNotEmpty({ message: 'Le nom du centre ne peut pas être vide.' })
  nom?: string;

  @ValidateIf((o) => o.adresse !== undefined)
  @Transform(trimTexte)
  @IsString({ message: "L'adresse ne peut pas être vide." })
  @IsNotEmpty({ message: "L'adresse ne peut pas être vide." })
  adresse?: string;

  @ValidateIf((o) => o.ville !== undefined)
  @Transform(trimTexte)
  @IsString({ message: 'La ville ne peut pas être vide.' })
  @IsNotEmpty({ message: 'La ville ne peut pas être vide.' })
  ville?: string;

  @ValidateIf((o) => o.codePostal !== undefined)
  @Transform(trimTexte)
  @IsString({ message: 'Le code postal ne peut pas être vide.' })
  @IsNotEmpty({ message: 'Le code postal ne peut pas être vide.' })
  codePostal?: string;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  telephone?: string | null;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  email?: string | null;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  departement?: string | null;

  @ValidateIf((o) => o.capacite !== undefined)
  @IsInt({ message: 'La capacité en lits ne peut pas être vide.' })
  @Min(1, { message: 'La capacité en lits doit être au moins 1.' })
  @Type(() => Number)
  capacite?: number;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    if (v === '') return null;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  })
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'Le site web doit commencer par http:// ou https://' })
  siteWeb?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.replace(/[\s.\-]/g, '');
    return v === '' ? null : v;
  })
  @IsString()
  @Length(14, 14, { message: 'Le SIRET doit contenir exactement 14 chiffres.' })
  siret?: string | null;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  tvaIntracommunautaire?: string | null;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  iban?: string | null;

  @ValidateIf((o) => o.equipements !== undefined)
  @IsArray({ message: 'Les équipements doivent être une liste (utilisez une liste vide pour tout retirer).' })
  @IsString({ each: true })
  equipements?: string[];

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  conditionsAnnulation?: string | null;

  @ValidateIf((o) => o.accessiblePmr !== undefined)
  @IsBoolean({ message: 'Le champ « accessible PMR » doit être vrai ou faux.' })
  accessiblePmr?: boolean;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  avisSecurite?: string | null;

  @ValidateIf((o) => o.thematiquesCentre !== undefined)
  @IsArray({ message: 'Les thématiques doivent être une liste (utilisez une liste vide pour tout retirer).' })
  @IsString({ each: true })
  thematiquesCentre?: string[];

  @ValidateIf((o) => o.activitesCentre !== undefined)
  @IsArray({ message: 'Les activités doivent être une liste (utilisez une liste vide pour tout retirer).' })
  @IsString({ each: true })
  activitesCentre?: string[];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  capaciteAdultes?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  capaciteGroupeMin?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  capaciteGroupeMax?: number | null;

  @IsOptional()
  @Transform(videVersNull)
  @IsString()
  periodeOuverture?: string | null;
}
