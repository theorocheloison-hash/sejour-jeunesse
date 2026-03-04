import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CentreController } from './centre.controller.js';
import { CentreService } from './centre.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CentreController],
  providers: [CentreService],
})
export class CentreModule {}
