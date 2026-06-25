import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AbonnementService } from './abonnement.service.js';

@Controller('abonnements')
@SkipThrottle()
export class AbonnementWebhookController {
  constructor(private readonly abonnementService: AbonnementService) {}

  /** POST /abonnements/webhook — appelé par Mollie (pas d'auth JWT). */
  @Post('webhook')
  webhook(@Body('id') id: string) {
    return this.abonnementService.handleWebhook(id);
  }
}
