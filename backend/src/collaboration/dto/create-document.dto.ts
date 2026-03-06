import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TypeDocumentSejour } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsEnum(TypeDocumentSejour)
  type!: TypeDocumentSejour;

  @IsOptional()
  @IsString()
  url?: string;
}
