import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCentreDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  codePostal?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacite?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
