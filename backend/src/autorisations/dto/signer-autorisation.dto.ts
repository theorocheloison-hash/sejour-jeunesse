import { IsOptional, IsString } from 'class-validator';

export class SignerAutorisationDto {
  @IsOptional()
  @IsString()
  infosMedicales?: string;
}
