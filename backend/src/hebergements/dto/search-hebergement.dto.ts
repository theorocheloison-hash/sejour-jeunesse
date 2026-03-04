import { IsOptional, IsString, IsInt, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchHebergementDto {
  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capaciteMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capaciteMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prixMax?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  agrement?: boolean;
}
