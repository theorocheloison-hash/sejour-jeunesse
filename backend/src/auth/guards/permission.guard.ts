import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermModule } from '../decorators/permission.decorator.js';
import { JwtUser } from '../decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { getUserCentrePermissions, hasPermission } from '../../centres/permission.helper.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<PermModule | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Pas de @RequirePermission → pas de restriction
    if (!module) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;
    if (!user) return false;

    // Déterminer le centreId depuis le header X-Centre-Id
    const centreIdHeader = request.headers['x-centre-id'];
    const centreId = Array.isArray(centreIdHeader) ? centreIdHeader[0] : centreIdHeader;
    if (!centreId) return true; // pas de centre sélectionné → getCentreForUser gère

    const perms = await getUserCentrePermissions(this.prisma, user.id, centreId);
    if (!perms) throw new ForbiddenException('Accès refusé à ce centre');

    // Propriétaire → toujours OK
    if (perms.isOwner) return true;

    // Déterminer le niveau requis selon la méthode HTTP
    const method = request.method?.toUpperCase();
    const requiredLevel: 'READ' | 'WRITE' =
      (method === 'GET' || method === 'HEAD') ? 'READ' : 'WRITE';

    if (!hasPermission(perms, module, requiredLevel)) {
      throw new ForbiddenException(
        requiredLevel === 'WRITE'
          ? 'Vous n\'avez pas les droits de modification sur ce module'
          : 'Vous n\'avez pas accès à ce module',
      );
    }
    return true;
  }
}
