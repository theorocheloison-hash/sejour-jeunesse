import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { SecuriteService } from './securite.service.js';

/**
 * ThrottlerGuard inchangé dans ses décisions (mêmes limites, même 429), qui
 * signale en plus chaque blocage au journal de sécurité. Ne bloque rien de plus.
 */
@Injectable()
export class SecuriteThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securite: SecuriteService,
  ) {
    super(options, storageService, reflector);
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const route = String(req?.originalUrl ?? req?.url ?? '').split('?')[0];
    const userAgent = req?.headers?.['user-agent'];
    // Fire-and-forget : le 429 part sans attendre le journal.
    void this.securite.blocageLimite(
      route,
      { ip: detail.tracker ?? req?.ip, userAgent: typeof userAgent === 'string' ? userAgent : null },
      Math.max(detail.timeToBlockExpire, 1) * 1000,
    );
    return super.throwThrottlingException(context, detail);
  }
}
