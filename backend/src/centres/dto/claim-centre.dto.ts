import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ClaimCentreDto {
  @IsUUID()
  centreId!: string;

  @IsOptional()
  @IsString()
  siretExtrait?: string;
}
