import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegisterTeacherDto } from './dto/register-teacher.dto.js';
import { RegisterVenueDto } from './dto/register-venue.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        motDePasse: hashed,
        role: dto.role ?? Role.PARENT,
        telephone: dto.telephone,
      },
    });

    return this.buildAuthResponse(user);
  }

  // ── Inscription enseignant ───────────────────────────────────────────

  async registerTeacher(dto: RegisterTeacherDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);
    const token = randomUUID();

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        motDePasse: hashed,
        role: Role.TEACHER,
        telephone: dto.telephone ?? null,
        emailVerifie: false,
        tokenVerification: token,
      },
    });

    await this.email.sendVerificationEmail(dto.email, dto.prenom, token);

    return {
      message: 'Inscription réussie. Vérifiez votre email pour activer votre compte.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Inscription hébergeur ────────────────────────────────────────────

  async registerVenue(dto: RegisterVenueDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);
    const token = randomUUID();

    // Créer User + CentreHebergement en transaction
    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          prenom: dto.prenom,
          nom: dto.nom,
          email: dto.email,
          motDePasse: hashed,
          role: Role.VENUE,
          telephone: dto.telephone ?? null,
          emailVerifie: false,
          tokenVerification: token,
        },
      }),
    ]);

    await this.prisma.centreHebergement.create({
      data: {
        nom: dto.nomCentre,
        adresse: dto.adresse,
        ville: dto.ville,
        codePostal: dto.codePostal,
        capacite: dto.capacite,
        description: dto.description ?? null,
        email: dto.emailContact ?? null,
        siret: dto.siret ?? null,
        departement: dto.departement ?? null,
        agrementEducationNationale: dto.agrementEducationNationale ?? null,
        typeSejours: dto.typeSejours ?? [],
        userId: user.id,
        statut: 'PENDING',
      },
    });

    await this.email.sendVerificationEmail(dto.email, dto.prenom, token);
    await this.email.sendVenueAccountPending(dto.email, dto.prenom, dto.nomCentre);

    return {
      message: 'Inscription réussie. Votre compte est en attente de validation.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Vérification email ───────────────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { tokenVerification: token },
    });
    if (!user) throw new NotFoundException('Lien de vérification invalide ou expiré');

    if (user.emailVerifie) {
      return { message: 'Votre email est déjà vérifié.' };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifie: true,
        tokenVerification: null,
      },
    });

    return { message: 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.' };
  }

  // ── Renvoyer l'email de vérification ─────────────────────────────────

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new NotFoundException('Aucun compte trouvé avec cet email');

    if (user.emailVerifie) {
      return { message: 'Votre email est déjà vérifié.' };
    }

    const token = randomUUID();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVerification: token },
    });

    await this.email.sendVerificationEmail(email, user.prenom, token);

    return { message: 'Email de vérification renvoyé.' };
  }

  // ── Login ────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const isValid = await bcrypt.compare(dto.password, user.motDePasse);
    if (!isValid) throw new UnauthorizedException('Identifiants invalides');

    if (!user.emailVerifie) {
      throw new UnauthorizedException('Veuillez vérifier votre email avant de vous connecter');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
      },
    };
  }
}
