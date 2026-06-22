import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // En-têtes de sécurité HTTP (nosniff, X-Frame-Options, Referrer-Policy, HSTS…).
  // CSP désactivé : l'API ne sert que du JSON (le magic link est un 302, pas un body HTML).
  app.use(helmet({
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));

  // Derrière le reverse proxy Scalingo : faire confiance au 1er proxy pour que
  // req.ip lise X-Forwarded-For (IP client réelle) au lieu de l'IP du proxy.
  // Sans cela, le ThrottlerGuard rate-limite sur une IP unique = compteur global.
  // '1' (et non 'true') pour ne truster qu'un seul proxy (non spoofable au-delà).
  app.set('trust proxy', 1);

  // Limite body JSON (imports volumineux, ex. POST /admin/sync-lmdj)
  app.use(json({ limit: '5mb' }));

  // Health check — avant tout middleware
  app.use('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok' });
  });

  // CORS — origines autorisées (Scalingo Paris)
  const ALLOWED_ORIGINS = [
    'https://liavo.fr',
    'https://www.liavo.fr',
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
      'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Centre-Id'
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
