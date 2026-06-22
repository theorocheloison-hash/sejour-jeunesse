import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { getUserCentrePermissions } from '../centres/permission.helper.js';
import { InviteCollaborateurDto } from './dto/invite-collaborateur.dto.js';
import { RegisterCollaborateurDto } from './dto/register-collaborateur.dto.js';

const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Injectable()
export class CollaborateurService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  /** Invite un collaborateur sur un ou plusieurs centres dont l'user est PROPRIÉTAIRE. */
  async inviter(userId: string, dto: InviteCollaborateurDto) {
    // 1. Vérifier que l'user est propriétaire de CHAQUE centre demandé
    const centres = await this.prisma.centreHebergement.findMany({
      where: { id: { in: dto.centreIds }, userId },
    });
    if (centres.length !== dto.centreIds.length) {
      throw new ForbiddenException('Vous devez être propriétaire de chaque centre pour inviter un collaborateur');
    }

    // 3. Un user HEBERGEUR existe-t-il déjà avec cet email ?
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, role: Role.HEBERGEUR },
      select: { id: true },
    });

    const inviteur = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { prenom: true, nom: true },
    });
    const inviteurNom = inviteur ? `${inviteur.prenom} ${inviteur.nom}` : 'un administrateur';

    const permissions = dto.permissions as unknown as Prisma.InputJsonValue;

    // 2. Upsert une ligne CollaborateurCentre par centre (unique centreId+inviteEmail)
    let invited = 0;
    for (const centre of centres) {
      const collab = await this.prisma.collaborateurCentre.upsert({
        where: { centreId_inviteEmail: { centreId: centre.id, inviteEmail: dto.email } },
        create: {
          centreId: centre.id,
          inviteEmail: dto.email,
          permissions,
          invitePar: userId,
          userId: existingUser?.id ?? null,
        },
        update: {
          permissions,
          userId: existingUser?.id ?? undefined,
        },
      });
      invited += 1;

      // 4. Email d'invitation (Brevo) — texte différent selon que le compte existe ou non
      const lien = `${FRONTEND_URL}/invitation-equipe/${collab.inviteToken}`;
      const subject = `Invitation à rejoindre ${centre.nom} sur LIAVO`;
      const message = existingUser
        ? `Vous avez été invité sur le centre <strong>${centre.nom}</strong> par ${inviteurNom}. `
          + `Connectez-vous pour accéder à votre espace : <a href="${lien}">${lien}</a>`
        : `Vous avez été invité sur LIAVO par ${inviteurNom}. `
          + `Créez votre compte pour accéder au centre <strong>${centre.nom}</strong> : <a href="${lien}">${lien}</a>`;
      try {
        await this.email.sendGenericNotification(dto.email, subject, message, centre.nom);
      } catch (err) {
        console.error('[collaborateur.inviter] échec envoi email', err);
      }
    }

    return { invited };
  }

  /** Liste les collaborateurs des centres dont l'user est propriétaire. */
  async getAll(userId: string) {
    return this.prisma.collaborateurCentre.findMany({
      where: { centre: { userId } },
      select: {
        id: true,
        inviteEmail: true,
        permissions: true,
        acceptedAt: true,
        createdAt: true,
        centre: { select: { id: true, nom: true } },
        user: { select: { prenom: true, nom: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Met à jour les permissions d'un collaborateur (propriétaire du centre uniquement). */
  async updatePermissions(userId: string, id: string, permissions: InviteCollaborateurDto['permissions']) {
    const collab = await this.prisma.collaborateurCentre.findUnique({
      where: { id },
      include: { centre: { select: { userId: true } } },
    });
    if (!collab) throw new NotFoundException('Collaborateur introuvable');
    if (collab.centre.userId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas propriétaire de ce centre');
    }
    return this.prisma.collaborateurCentre.update({
      where: { id },
      data: { permissions: permissions as unknown as Prisma.InputJsonValue },
    });
  }

  /** Supprime un collaborateur (propriétaire du centre uniquement). */
  async remove(userId: string, id: string) {
    const collab = await this.prisma.collaborateurCentre.findUnique({
      where: { id },
      include: { centre: { select: { userId: true } } },
    });
    if (!collab) throw new NotFoundException('Collaborateur introuvable');
    if (collab.centre.userId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas propriétaire de ce centre');
    }
    await this.prisma.collaborateurCentre.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Inscription simplifiée d'un collaborateur invité (sans compte ni centre).
   * Le clic sur le lien email vaut preuve de propriété → emailVerifie = true.
   */
  async registerCollaborateur(dto: RegisterCollaborateurDto) {
    // 1. Trouver l'invitation par token
    const invitation = await this.prisma.collaborateurCentre.findUnique({
      where: { inviteToken: dto.token },
      include: { centre: { select: { nom: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Invitation déjà acceptée');

    // 2. Vérifier qu'aucun user n'existe avec cet email
    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.inviteEmail },
    });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec cette adresse email. Connectez-vous pour accepter l\'invitation.',
      );
    }

    // 3. Créer le user HEBERGEUR avec emailVerifie = true
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: invitation.inviteEmail,
        motDePasse: hashed,
        role: Role.HEBERGEUR,
        emailVerifie: true,
        compteValide: true,
      },
    });

    this.email.notifyAdminNewAccount(
      { prenom: user.prenom, nom: user.nom, email: user.email, role: user.role },
      'Collaborateur d\'équipe (invité par un hébergeur existant).',
    ).catch(() => {});

    // 4. Accepter TOUTES les invitations en attente pour cet email (multi-centres)
    await this.prisma.collaborateurCentre.updateMany({
      where: { inviteEmail: invitation.inviteEmail, acceptedAt: null },
      data: { userId: user.id, acceptedAt: new Date() },
    });

    // 5. JWT + user (login automatique)
    // JWT access token avec tokenVersion (cohérent avec auth.service.ts)
    const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: 0 };
    const access_token = this.jwtService.sign(payload);

    // Refresh token rotatif 30j (même pattern que auth.service.buildAuthResponse)
    const refreshToken = randomUUID();
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenExpires },
    });

    return {
      access_token,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role },
    };
  }

  /** Détails publics d'une invitation (pour la page d'acceptation, avant connexion). */
  async getInvitation(token: string) {
    const collab = await this.prisma.collaborateurCentre.findUnique({
      where: { inviteToken: token },
      select: {
        inviteEmail: true,
        acceptedAt: true,
        centre: { select: { nom: true } },
        inviteur: { select: { prenom: true, nom: true } },
      },
    });
    if (!collab) throw new NotFoundException('Invitation introuvable');
    return {
      email: collab.inviteEmail,
      acceptedAt: collab.acceptedAt,
      centre: { nom: collab.centre.nom },
      inviteur: { prenom: collab.inviteur.prenom, nom: collab.inviteur.nom },
    };
  }

  /** Accepte une invitation : lie le userId connecté et marque acceptedAt. */
  async accepter(userId: string, userEmail: string, token: string) {
    const collab = await this.prisma.collaborateurCentre.findUnique({
      where: { inviteToken: token },
    });
    if (!collab) throw new NotFoundException('Invitation introuvable');
    if (collab.inviteEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException('Cette invitation ne vous est pas destinée');
    }
    return this.prisma.collaborateurCentre.update({
      where: { id: collab.id },
      data: { userId, acceptedAt: new Date() },
    });
  }

  /** Permissions de l'user connecté sur le centre actif (X-Centre-Id, ou centre par défaut). */
  async mesPermissions(userId: string, centreId?: string | null) {
    let cid = centreId;
    if (!cid) {
      const centre = await getCentreForUser(this.prisma, userId);
      cid = centre.id;
    }
    const perms = await getUserCentrePermissions(this.prisma, userId, cid);
    if (!perms) throw new ForbiddenException('Aucun accès à ce centre');
    return perms;
  }
}
