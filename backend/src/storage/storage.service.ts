import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('S3_ENDPOINT')!;
    this.bucket = this.config.get<string>('S3_BUCKET_NAME')!;
    this.publicUrl = this.config.get<string>('S3_PUBLIC_URL')!;
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'gra',
      endpoint: this.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY')!,
      },
    });
    console.log('StorageService initialized (OVH S3)');
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const ALLOWED_MIME_TYPES = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}. Formats acceptés : JPEG, PNG, WEBP, PDF.`,
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). Maximum : 10 Mo.`,
      );
    }

    console.log('S3 upload file:', JSON.stringify({ originalname: file.originalname, mimetype: file.mimetype, size: file.size }));
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
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
        ACL: ObjectCannedACL.public_read,
      }));
    } catch (e) {
      console.error('S3 upload error:', e instanceof Error ? e.stack : JSON.stringify(e, null, 2));
      throw new InternalServerErrorException(`Erreur upload fichier: ${(e as any)?.message ?? 'unknown'}`);
    }
    return `${this.publicUrl}/${key}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimetype: string,
  ): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${randomUUID()}-${safeName}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: ObjectCannedACL.public_read,
      }));
    } catch (e) {
      console.error('S3 uploadBuffer error:', e instanceof Error ? e.stack : JSON.stringify(e, null, 2));
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
