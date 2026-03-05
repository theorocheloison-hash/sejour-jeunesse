import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SejourModule } from './sejours/sejour.module.js';
import { AutorisationModule } from './autorisations/autorisation.module.js';
import { HebergementModule } from './hebergements/hebergement.module.js';
import { InvitationModule } from './invitations/invitation.module.js';
import { CentreModule } from './centres/centre.module.js';
import { AbonnementModule } from './abonnements/abonnement.module.js';
import { DemandeModule } from './demandes/demande.module.js';
import { DevisModule } from './devis/devis.module.js';
import { CollaborationModule } from './collaboration/collaboration.module.js';
import { EmailModule } from './email/email.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    AuthModule,
    SejourModule,
    AutorisationModule,
    HebergementModule,
    InvitationModule,
    CentreModule,
    AbonnementModule,
    DemandeModule,
    DevisModule,
    CollaborationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
