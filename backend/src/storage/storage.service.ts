import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('R2_ENDPOINT')!;
    this.bucket = this.config.get<string>('R2_BUCKET_NAME')!;
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL')!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
    console.log('R2 ENDPOINT:', JSON.stringify(this.endpoint));
    console.log('R2 BUCKET:', JSON.stringify(this.bucket));
    console.log('R2 PUBLIC URL:', JSON.stringify(this.publicUrl));
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    console.log('R2 upload file:', JSON.stringify({ originalname: file.originalname, mimetype: file.mimetype, size: file.size }));
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
    };
    const ext = mimeToExt[file.mimetype] ?? 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: mimeToExt[file.mimetype] ? file.mimetype : 'application/octet-stream',
      }));
    } catch (e) {
      console.error('R2 upload error:', JSON.stringify(e, null, 2));
      throw new InternalServerErrorException(`Erreur upload fichier: ${(e as any)?.message ?? 'unknown'}`);
    }
    return `${this.publicUrl}/${key}`;
  }

  async delete(url: string): Promise<void> {
    try {
      const publicBase = this.publicUrl.endsWith('/') ? this.publicUrl : `${this.publicUrl}/`;
      const key = url.startsWith(publicBase) ? url.slice(publicBase.length) : url.split(`/${this.bucket}/`)[1];
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
