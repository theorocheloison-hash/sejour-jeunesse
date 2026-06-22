import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

// Cookie httpOnly d'abord (Phase 1 4a), fallback Authorization header (backward compat)
function cookieThenBearerExtractor(req: Request): string | null {
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieThenBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload & { tokenVersion?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        reseauNom: true,
        reseauNomComplet: true,
        compteValide: true,
        tokenVersion: true,
      },
    });
    if (!user) throw new UnauthorizedException('Token invalide');

    // Révocation : si tokenVersion a été incrémenté (changement MDP, suspension), rejeter
    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expirée');
    }

    // Gate hébergeur : admin peut suspendre via compteValide=false
    if (user.role === 'HEBERGEUR' && !user.compteValide) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return user;
  }
}
