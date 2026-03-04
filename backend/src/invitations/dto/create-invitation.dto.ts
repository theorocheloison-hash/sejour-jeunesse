import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(1)
  nomCentre: string;
}
