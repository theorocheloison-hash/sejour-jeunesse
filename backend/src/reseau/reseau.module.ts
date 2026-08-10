import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReseauController } from './reseau.controller.js';
import { ReseauService } from './reseau.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ReseauController],
  providers: [ReseauService],
  // Exporté : AdminController sert l'onglet Réseaux du dashboard admin via
  // GET /admin/reseau/:reseau/stats → getReseauStats.
  exports: [ReseauService],
})
export class ReseauModule {}
