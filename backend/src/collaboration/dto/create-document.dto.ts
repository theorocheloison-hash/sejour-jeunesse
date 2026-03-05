import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { TypeDocumentSejour } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsEnum(TypeDocumentSejour)
  type!: TypeDocumentSejour;

  @IsString()
  @IsNotEmpty()
  url!: string;
}
