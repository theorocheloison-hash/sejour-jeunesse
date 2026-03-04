import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TypeDocument } from '@prisma/client';

export class CreateDocumentDto {
  @IsEnum(TypeDocument)
  type: TypeDocument;

  @IsString()
  @MinLength(1)
  nom: string;

  @IsOptional()
  @IsDateString()
  dateExpiration?: string;
}
