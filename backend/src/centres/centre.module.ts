import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { CentreController } from './centre.controller.js';
import { CentreService } from './centre.service.js';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [CentreController],
  providers: [CentreService],
})
export class CentreModule {}
