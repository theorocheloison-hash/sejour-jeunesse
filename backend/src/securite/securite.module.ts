import { Global, Module } from '@nestjs/common';
import { SecuriteService } from './securite.service.js';

/** Global : journal et alertes de sécurité appelés depuis auth, admin,
 *  collaboration, storage et le guard anti-abus (même patron que Prisma/Email/Storage). */
@Global()
@Module({
  providers: [SecuriteService],
  exports: [SecuriteService],
})
export class SecuriteModule {}
