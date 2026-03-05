import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://precious-comfort-production-52c6.up.railway.app',
      'https://easygoing-luck-production-f0df.up.railway.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // supprime les champs non déclarés dans les DTOs
      forbidNonWhitelisted: true, // renvoie une erreur si des champs inconnus sont envoyés
      transform: true,         // transforme les payloads en instances de DTO
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
