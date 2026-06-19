import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
