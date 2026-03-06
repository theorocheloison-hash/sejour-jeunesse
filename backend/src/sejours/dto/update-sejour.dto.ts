import { IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

export class UpdateSejourDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  prix?: number;

  @IsOptional()
  @IsDateString()
  dateLimiteInscription?: string;
}
