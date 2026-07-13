import { IsInt, IsOptional, IsString, Length, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateCentreDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  @IsString()
  @MinLength(1)
  adresse!: string;

  @IsString()
  @MinLength(1)
  ville!: string;

  @IsString()
  @MinLength(1)
  codePostal!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacite!: number;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s.\-]/g, '') : value))
  @IsString()
  @Length(14, 14, { message: 'Le SIRET doit contenir exactement 14 chiffres.' })
  siret?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
