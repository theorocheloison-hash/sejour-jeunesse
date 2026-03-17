import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('R2_ENDPOINT')!;
    this.bucket = this.config.get<string>('R2_BUCKET_NAME')!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
    } catch (e) {
      throw new InternalServerErrorException('Erreur upload fichier');
    }
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async delete(url: string): Promise<void> {
    try {
      const key = url.split(`/${this.bucket}/`)[1];
      if (!key) return;
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch {
      // ignore — fichier déjà supprimé ou introuvable
    }
  }
}
