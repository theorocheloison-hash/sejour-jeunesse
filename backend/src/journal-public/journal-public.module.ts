import { Module } from '@nestjs/common';
import { JournalPublicController } from './journal-public.controller.js';

@Module({
  controllers: [JournalPublicController],
})
export class JournalPublicModule {}
