import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Health check — avant tout middleware
  app.use('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok' });
  });

  // CORS whitelist — CORS_ORIGIN doit être défini sur Railway (ex: https://liavo.fr)
  const ALLOWED_ORIGINS = [
    'https://liavo.fr',
    'https://www.liavo.fr',
    process.env.CORS_ORIGIN,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[];

  app.use((req: any, res: any, next: any) => {
    const origin = req.headers['origin'];
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin,X-Requested-With,Content-Type,Accept,Authorization'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on port ${port}`);
}
bootstrap();
