import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchHebergementDto {
  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  region?: string;

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
}
