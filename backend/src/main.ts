import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // ── Migration manuelle admin (à retirer après premier déploiement réussi) ──
  try {
    const prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "utilisateurs"
      ADD COLUMN IF NOT EXISTS "compte_valide" BOOLEAN NOT NULL DEFAULT true;
    `);
    // Vérifier si ADMIN existe déjà dans l'enum
    const adminExists: any[] = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'Role' AND e.enumlabel = 'ADMIN'
    `);
    if (adminExists.length === 0) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE 'ADMIN'`);
    }
    // Créer admin si inexistant
    await prisma.$executeRawUnsafe(`
      INSERT INTO "utilisateurs" (id, email, "mot_de_passe", role, prenom, nom, "email_verifie", "compte_valide", "created_at", "updated_at")
      SELECT gen_random_uuid(), 'admin@sejour-jeunesse.fr',
        '$2b$10$Ldl8wAcILXJqLD9vEBsFxuIx9wn7X1ausEBf2RXJ0Q55wJMNM5sKu',
        'ADMIN'::"Role", 'Admin', 'Séjour Jeunesse', true, true, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "utilisateurs" WHERE email = 'admin@sejour-jeunesse.fr')
    `);
    console.log('[MIGRATION] Admin migration applied successfully');
  } catch (err) {
    console.error('[MIGRATION] Admin migration error (non-blocking):', err);
  }

  // Serve uploaded files statically
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Health check — avant tout middleware
  app.use('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok' });
  });

  // CORS avant tout middleware
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers['origin'];
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Vary', 'Origin');
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
