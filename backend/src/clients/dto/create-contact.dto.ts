import { IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  @IsString() prenom!: string;
  @IsString() nom!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() notes?: string;
}
