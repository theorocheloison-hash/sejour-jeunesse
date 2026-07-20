import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

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

  // Parse les cookies (JWT httpOnly — Phase 1 4a). Doit précéder CORS et les routes
  // pour que req.cookies soit peuplé avant la JwtStrategy.
  app.use(cookieParser());

  // Derrière le reverse proxy Scalingo : faire confiance aux hops internes pour que
  // req.ip lise l'IP client réelle (X-Forwarded-For) et non une IP interne 10.x.
  // On truste par PLAGES d'IP privées (loopback/linklocal/uniquelocal) plutôt que par
  // un nombre de hops : Express dépouille tous les proxies internes depuis la droite
  // jusqu'à la première IP publique = l'IP observée par le routeur Scalingo. Robuste
  // au nombre de proxies (inconnu/variable), non spoofable tant que le routeur ajoute
  // lui-même l'IP réelle à la chaîne. Impacte req.ip partout : ThrottlerGuard (rate-
  // limit par vrai client) + captures d'IP signatures parentales / devis / CGV / mandat.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

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

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on port ${port}`);
}
bootstrap();
