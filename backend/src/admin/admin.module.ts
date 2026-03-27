import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController, ReseauController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, ReseauController],
  providers: [AdminService],
})
export class AdminModule {}
