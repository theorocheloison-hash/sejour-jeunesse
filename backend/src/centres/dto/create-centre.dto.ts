import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  siret?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
