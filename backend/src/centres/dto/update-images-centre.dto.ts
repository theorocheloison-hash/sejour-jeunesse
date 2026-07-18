import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';
import { MAX_PHOTOS_CENTRE } from '../centre.service.js';

export class SupprimerImageCentreDto {
  @IsString()
  @MinLength(1)
  url: string;
}

export class ReordonnerImagesCentreDto {
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_CENTRE)
  @IsString({ each: true })
  urls: string[];
}
