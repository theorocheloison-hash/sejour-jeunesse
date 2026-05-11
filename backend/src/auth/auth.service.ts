import {
  BadRequestException,
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
import { RegisterOrganisateurDto } from './dto/register-organisateur.dto.js';
import { RegisterHebergeurDto } from './dto/register-hebergeur.dto.js';
import { RegisterSignataireDto } from './dto/register-signataire.dto.js';
import { findOrCreateOrganisation, findOrCreateMembership } from '../organisations/organisation.helpers.js';

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

  // ── Inscription organisateur ─────────────────────────────────────────

  async registerOrganisateur(dto: RegisterOrganisateurDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);
    const token = randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        motDePasse: hashed,
        role: Role.ORGANISATEUR,
        telephone: dto.telephone ?? null,
        emailVerifie: false,
        tokenVerification: token,
        tokenVerificationExpires: tokenExpires,
      },
    });

    await this.prisma.consentementRgpd.create({
      data: {
        userId: user.id,
        role: Role.ORGANISATEUR,
        versionDpa: process.env.DPA_VERSION ?? '1.0',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        etablissementUai: null,
      },
    });

    // Créer Organisation + Membership depuis les infos d'inscription
    if (dto.etablissementNom || dto.etablissementUai) {
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom:           dto.etablissementNom ?? `${dto.prenom} ${dto.nom}`,
        uai:           dto.etablissementUai ?? null,
        adresse:       dto.etablissementAdresse ?? null,
        ville:         dto.etablissementVille ?? null,
        typeStructure: (dto.typeStructure as any) ?? null,
        source:        'MANUAL',
      });
      await findOrCreateMembership(this.prisma, {
        userId:         user.id,
        organisationId: organisation.id,
        role:           'PROPRIETAIRE',
        isPrimary:      true,
        claimStatut:    'NON_APPLICABLE',
      });
    }

    await this.email.sendVerificationEmail(dto.email, dto.prenom, token);

    return {
      message: 'Inscription réussie. Vérifiez votre email pour activer votre compte.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Inscription signataire ───────────────────────────────────────────

  async registerSignataire(dto: RegisterSignataireDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);
    const token = randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        motDePasse: hashed,
        role: Role.SIGNATAIRE,
        telephone: dto.telephone ?? null,
        emailVerifie: false,
        compteValide: true,
        tokenVerification: token,
        tokenVerificationExpires: tokenExpires,
      },
    });

    // Membership automatique si invitation avec organisationId
    if (dto.organisationId) {
      await findOrCreateMembership(this.prisma, {
        userId:         user.id,
        organisationId: dto.organisationId,
        role:           'MEMBRE',
        isPrimary:      true,
        claimStatut:    'NON_APPLICABLE',
      });
    }

    // Marquer l'invitation comme utilisée si token présent
    if (dto.invitationToken) {
      await this.prisma.invitationDirecteur.updateMany({
        where: { token: dto.invitationToken, utilisedAt: null },
        data:  { utilisedAt: new Date() },
      }).catch(() => {}); // non bloquant
    }

    await this.prisma.consentementRgpd.create({
      data: {
        userId: user.id,
        role: Role.SIGNATAIRE,
        versionDpa: process.env.DPA_VERSION ?? '1.0',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        etablissementUai: dto.etablissementUai ?? null,
      },
    });

    await this.email.sendVerificationEmail(dto.email, dto.prenom, token);

    return {
      message: 'Inscription réussie. Vérifiez votre email pour activer votre compte.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Inscription hébergeur ────────────────────────────────────────────

  async registerHebergeur(dto: RegisterHebergeurDto, ipAddress?: string, userAgent?: string) {
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
          role: Role.HEBERGEUR,
          telephone: dto.telephone ?? null,
          emailVerifie: false,
          tokenVerification: token,
          tokenVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    const centre = await this.prisma.centreHebergement.create({
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
        reseau: dto.reseau ?? null,
        userId: user.id,
        statut: 'PENDING',
      },
    });

    // Lier l'invitation centre externe si un token est fourni
    if (dto.invitationToken) {
      try {
        await this.prisma.invitationCentreExterne.updateMany({
          where: { token: dto.invitationToken, demandeCreee: false },
          data: { centreId: centre.id },
        });
      } catch { /* non bloquant */ }
    }

    // Rattacher l'hébergeur à une Organisation + Membership (non bloquant)
    try {
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom:              dto.nomCentre,
        adresse:          dto.adresse,
        codePostal:       dto.codePostal,
        ville:            dto.ville,
        emailContact:     dto.emailContact ?? null,
        telephoneContact: dto.telephone ?? null,
        siret:            dto.siret ?? null,
        siren:            dto.siret ? dto.siret.substring(0, 9) : null,
        typeStructure:    null,
        source:           'MANUAL',
      });
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { organisationId: organisation.id },
      });
      await findOrCreateMembership(this.prisma, {
        userId:         user.id,
        organisationId: organisation.id,
        role:           'PROPRIETAIRE',
        isPrimary:      true,
        claimStatut:    'NON_APPLICABLE',
      });
    } catch (err) {
      console.error('[registerHebergeur] Echec rattachement Organisation/Membership', err);
    }

    await this.prisma.consentementRgpd.create({
      data: {
        userId: user.id,
        role: Role.HEBERGEUR,
        versionDpa: process.env.DPA_VERSION ?? '1.0',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.email.sendVerificationEmail(dto.email, dto.prenom, token);
    await this.email.sendHebergeurAccountPending(dto.email, dto.prenom, dto.nomCentre);

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

    if (user.tokenVerificationExpires && user.tokenVerificationExpires < new Date()) {
      throw new BadRequestException('Lien de vérification expiré. Demandez un nouvel email.');
    }

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
      data: {
        tokenVerification: token,
        tokenVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.email.sendVerificationEmail(email, user.prenom, token);

    return { message: 'Email de vérification renvoyé.' };
  }

  async renvoyerMagicLink(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.compteValide) {
      return { message: 'Si cet email correspond à une demande en cours, un lien a été envoyé.' };
    }
    const magicToken = randomUUID();
    const magicExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
    });
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const magicUrl = `${frontendUrl}/auth/magic/${magicToken}`;
    await this.email.sendMagicLink(user.email, user.prenom, 'votre demande de séjour', magicUrl);
    return { message: 'Lien d\'accès envoyé.' };
  }

  // ── Login ────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    if (!user.compteValide && !user.emailVerifie) {
      throw new UnauthorizedException('COMPTE_DORMANT');
    }

    const isValid = await bcrypt.compare(dto.password, user.motDePasse);
    if (!isValid) throw new UnauthorizedException('Identifiants invalides');

    if (!user.emailVerifie) {
      throw new UnauthorizedException('Veuillez vérifier votre email avant de vous connecter');
    }

    return this.buildAuthResponse(user);
  }

  // ── Recherche SIRENE ────────────────────────────────────────────────

  async searchSirene(siret: string) {
    try {
      const cleaned = siret.replace(/[\s\-]/g, '');
      if (!/^\d{14}$/.test(cleaned)) return { found: false };

      const url = `https://recherche-entreprises.api.gouv.fr/search?q=${cleaned}&mtypes=etablissement&nombre=1`;
      const res = await fetch(url);
      if (!res.ok) return { found: false };

      const data = await res.json();
      const results = data?.results;
      if (!results || results.length === 0) return { found: false };

      const etab = results[0];
      const siege = etab.siege;
      const match = etab.matching_etablissements?.[0];

      const codePostal = siege?.code_postal ?? match?.code_postal ?? '';
      const dept = codePostal.startsWith('97') || codePostal.startsWith('98')
        ? codePostal.slice(0, 3)
        : codePostal.slice(0, 2);

      return {
        found: true,
        raisonSociale: etab.nom_raison_sociale ?? etab.nom_complet ?? '',
        adresse: siege?.geo_adresse ?? siege?.adresse ?? match?.geo_adresse ?? '',
        ville: siege?.libelle_commune ?? match?.libelle_commune ?? '',
        codePostal,
        siret: siege?.siret ?? cleaned,
        siren: cleaned.slice(0, 9),
        departement: dept,
      };
    } catch {
      return { found: false };
    }
  }

  async demanderResetPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Toujours retourner success même si l'email n'existe pas (sécurité)
    if (!user) return { message: 'Si cet email existe, un lien a été envoyé.' };

    const token = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await this.prisma.user.update({
      where: { email },
      data: { resetPasswordToken: token, resetPasswordExpires: expires },
    });

    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/reset-password/${token}`;
    await this.email.sendGenericNotification(
      email,
      'Réinitialisation de votre mot de passe LIAVO',
      `<p>Bonjour,</p>
       <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
       <p style="margin:24px 0">
         <a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Réinitialiser mon mot de passe
         </a>
       </p>
       <p style="color:#888;font-size:12px">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>`,
    );

    return { message: 'Si cet email existe, un lien a été envoyé.' };
  }

  async reinitialiserMotDePasse(token: string, nouveauMotDePasse: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Lien invalide ou expiré');

    const hash = await bcrypt.hash(nouveauMotDePasse, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        motDePasse: hash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async consommerMagicLink(token: string, res: any) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    const user = await this.prisma.user.findFirst({
      where: {
        magicLinkToken: token,
        magicLinkExpires: { gte: new Date() },
      },
    });

    if (!user) {
      return res.redirect(`${frontendUrl}/login?error=magic_link_expired`);
    }

    // Activer le compte + invalider le token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        compteValide:     true,
        emailVerifie:     true,
        magicLinkToken:   null,
        magicLinkExpires: null,
      },
    });

    // Générer JWT et rediriger
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);

    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&onboarding=true`
    );
  }

  private buildAuthResponse(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      reseau: user.reseauNom ?? null,
    };
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

  async definirMotDePasse(userId: string, password: string): Promise<{ success: boolean }> {
    if (!password || password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }
    const hash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { motDePasse: hash },
    });
    return { success: true };
  }
}
