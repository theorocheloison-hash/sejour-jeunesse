import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlanAbonnement, Role, StatutAbonnement } from '@prisma/client';
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
import { ClaimService } from '../organisations/claim.service.js';
import { normaliserDepartement } from '../utils/departements.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
    private claimService: ClaimService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom,
        nom: dto.nom,
        email: dto.email,
        motDePasse: hashed,
        motDePasseDefini: true,
        role: Role.PARENT,
        telephone: dto.telephone,
      },
    });

    return this.buildAuthResponse(user);
  }

  // ── Inscription organisateur ─────────────────────────────────────────

  async registerOrganisateur(dto: RegisterOrganisateurDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
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
        motDePasseDefini: true,
        role: Role.ORGANISATEUR,
        telephone: dto.telephone ?? null,
        emailVerifie: false,
        // Organisateur : pas de validation admin requise (≠ hébergeur).
        compteValide: true,
        tokenVerification: token,
        tokenVerificationExpires: tokenExpires,
        accompagnateurTokenPending: dto.accompagnateurToken ?? null,
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
        typeStructure: dto.typeStructure ?? null,
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

    this.email.notifyAdminNewAccount(
      { prenom: user.prenom, nom: user.nom, email: user.email, role: user.role },
    ).catch(() => {});

    return {
      message: 'Inscription réussie. Vérifiez votre email pour activer votre compte.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Inscription signataire ───────────────────────────────────────────

  async registerSignataire(dto: RegisterSignataireDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
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
        motDePasseDefini: true,
        role: Role.SIGNATAIRE,
        telephone: dto.telephone ?? null,
        emailVerifie: false,
        compteValide: true,
        tokenVerification: token,
        tokenVerificationExpires: tokenExpires,
      },
    });

    // B8 fix : membership UNIQUEMENT si l'invitation est valide et correspond à l'organisationId.
    // Sans invitation validée → pas de membership (l'organisationId du body seul ne suffit pas).
    if (dto.organisationId && dto.invitationToken) {
      const invitation = await this.prisma.invitationDirecteur.findFirst({
        where: { token: dto.invitationToken, utilisedAt: null },
        select: { id: true, organisationId: true },
      });
      if (invitation && invitation.organisationId === dto.organisationId) {
        await findOrCreateMembership(this.prisma, {
          userId:         user.id,
          organisationId: dto.organisationId,
          role:           'MEMBRE',
          isPrimary:      true,
          claimStatut:    'NON_APPLICABLE',
        });
        await this.prisma.invitationDirecteur.update({
          where: { id: invitation.id },
          data:  { utilisedAt: new Date() },
        });
      }
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

    this.email.notifyAdminNewAccount(
      { prenom: user.prenom, nom: user.nom, email: user.email, role: user.role },
    ).catch(() => {});

    return {
      message: 'Inscription réussie. Vérifiez votre email pour activer votre compte.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Inscription hébergeur ────────────────────────────────────────────

  async registerHebergeur(
    dto: RegisterHebergeurDto,
    ipAddress?: string,
    userAgent?: string,
    file?: Express.Multer.File,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
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
          motDePasseDefini: true,
          role: Role.HEBERGEUR,
          telephone: dto.telephone ?? null,
          emailVerifie: false,
          // Compte utilisable immédiatement : la validation admin ne bloque plus
          // le login mais le passage du centre PENDING→ACTIVE (catalogue + envois
          // externes). compteValide sert désormais de kill switch admin.
          compteValide: true,
          tokenVerification: token,
          tokenVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // Multi-user : si cet email a été invité comme collaborateur (avant d'avoir un compte),
    // on renseigne le userId. L'utilisateur devra encore accepter via le lien d'invitation.
    try {
      await this.prisma.collaborateurCentre.updateMany({
        where: { inviteEmail: user.email, userId: null },
        data: { userId: user.id },
      });
    } catch (err) {
      console.error('[registerHebergeur] liaison collaborateur échec', err);
    }

    // Notification admin (fire-and-forget) — couvre les deux modes (claim + normal).
    // Le compte est utilisable immédiatement ; la validation admin porte sur le
    // passage du centre PENDING→ACTIVE, pas sur le login.
    this.email.notifyAdminNewAccount(
      { prenom: user.prenom, nom: user.nom, email: user.email, role: user.role },
      `Centre&nbsp;: ${dto.nomCentre}`
        + (dto.ville ? `<br>Ville&nbsp;: ${dto.ville}` : '')
        + (dto.siret ? `<br>SIRET&nbsp;: ${dto.siret}` : ''),
    ).catch(() => {});

    // ── Mode revendication catalogue : créer UNIQUEMENT le user. Le centre,
    //    l'organisation et le membership de claim sont gérés par claimFromCatalogue. ──
    if (dto.claimCatalogueId) {
      // Le user est créé ; on tente le claim inline. Si le claim échoue, on
      // n'avale PAS l'erreur silencieusement : le user reste créé (il pourra
      // retenter plus tard), mais la réponse signale clairement l'échec.
      let claimResult: Awaited<ReturnType<ClaimService['claimFromCatalogue']>> | null = null;
      let claimError: string | null = null;
      try {
        claimResult = await this.claimService.claimFromCatalogue(
          dto.claimCatalogueId, user.id, Role.HEBERGEUR, file,
        );
      } catch (err) {
        console.error('[registerHebergeur] Echec claim-from-catalogue', err);
        claimError = err instanceof Error ? err.message : 'Erreur lors de la revendication';
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
        message: claimResult
          ? 'Inscription réussie. Votre demande de revendication est en attente de validation.'
          : 'Inscription réussie. La revendication du centre a échoué — vous pourrez réessayer depuis votre espace.',
        user: { id: user.id, email: user.email, role: user.role },
        claim: claimResult ? { claimStatut: claimResult.claimStatut } : null,
        claimError,
      };
    }

    // Mode normal : les informations du centre sont obligatoires
    if (!dto.adresse || !dto.ville || !dto.codePostal || dto.capacite == null) {
      throw new BadRequestException('Les informations du centre sont obligatoires.');
    }
    const { adresse, ville, codePostal, capacite } = dto;

    const centre = await this.prisma.centreHebergement.create({
      data: {
        nom: dto.nomCentre,
        adresse,
        ville,
        codePostal,
        capacite,
        description: dto.description ?? null,
        email: dto.emailContact ?? null,
        siret: dto.siret ?? null,
        departement: normaliserDepartement(dto.departement),
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
        adresse,
        codePostal,
        ville,
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

    // Le trial 30j Pilotage s'active à la première connexion (voir login()),
    // plus à l'inscription : le centre reste abonnementStatut INACTIF ici.
    // Les relances d'expiration sont gérées par CronAlertesService.

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

    // Notification admin envoyée plus haut via notifyAdminNewAccount (couvre claim + normal).

    return {
      message: 'Inscription réussie. Votre compte est en attente de validation.',
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ── Vérification email ───────────────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { tokenVerification: token },
      select: {
        id: true,
        role: true,
        compteValide: true,
        emailVerifie: true,
        tokenVerificationExpires: true,
        accompagnateurTokenPending: true,
      },
    });
    if (!user) throw new NotFoundException('Lien de vérification invalide ou expiré');

    if (user.tokenVerificationExpires && user.tokenVerificationExpires < new Date()) {
      throw new BadRequestException('Lien de vérification expiré. Demandez un nouvel email.');
    }

    if (user.emailVerifie) {
      // role + compteValide : le frontend en a besoin pour afficher le bon message
      // (hébergeur encore en attente de validation vs compte directement utilisable).
      return { message: 'Votre email est déjà vérifié.', role: user.role, compteValide: user.compteValide };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifie: true,
        tokenVerification: null,
      },
    });

    if (user.accompagnateurTokenPending) {
      try {
        const accompagnateur = await this.prisma.accompagnateurMission.findUnique({
          where: { tokenAcces: user.accompagnateurTokenPending },
        });
        if (accompagnateur && accompagnateur.accesCollaboratif && !accompagnateur.userId) {
          await this.prisma.accompagnateurMission.update({
            where: { tokenAcces: user.accompagnateurTokenPending },
            data: { userId: user.id },
          });
        }
        await this.prisma.user.update({
          where: { id: user.id },
          data: { accompagnateurTokenPending: null },
        });
      } catch { /* non bloquant */ }
    }

    return {
      message: 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.',
      role: user.role,
      compteValide: user.compteValide,
    };
  }

  // ── Renvoyer l'email de vérification ─────────────────────────────────

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, prenom: true, emailVerifie: true },
    });
    if (!user) return { message: 'Si cet email est enregistré, un lien a été envoyé.' };

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
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, prenom: true, motDePasseDefini: true },
    });
    if (!user || user.motDePasseDefini) {
      return { message: 'Si cet email correspond à un compte, un lien a été envoyé.' };
    }
    const magicUrl = await this.genererMagicUrl(user.id);
    await this.email.sendMagicLink(email, user.prenom, 'votre séjour', magicUrl);
    return { message: 'Si cet email correspond à un compte, un lien a été envoyé.' };
  }

  // ── Login ────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Hash factice (bcrypt 12 rounds d'une chaîne aléatoire) pour garantir un temps
    // de réponse constant même si l'utilisateur n'existe pas (anti timing oracle).
    const DUMMY_HASH = '$2b$12$zaLk1a47UZc53FAmRBXI9O5RqlXxpzS5.SI9NHpsXOYavERAiuqNK';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        role: true,
        motDePasse: true,
        motDePasseDefini: true,
        compteValide: true,
        emailVerifie: true,
        reseauNom: true,
        tokenVersion: true,
      },
    });

    // Toujours exécuter bcrypt (timing constant) : sur DUMMY_HASH si l'user n'existe
    // pas ou n'a pas encore défini son mot de passe (motDePasse = UUID aléatoire).
    const isValid = await bcrypt.compare(
      dto.password,
      user && user.motDePasseDefini ? user.motDePasse : DUMMY_HASH,
    );

    if (!user || !isValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // À partir d'ici le mot de passe est validé — les messages spécifiques
    // ne permettent plus d'énumérer les emails (l'attaquant doit connaître le MDP).

    // Gate 2 : email vérifié.
    if (!user.emailVerifie) {
      throw new UnauthorizedException('EMAIL_NON_VERIFIE');
    }

    // Gate 3 : kill switch admin pour les hébergeurs. compteValide est posé à true
    // dès le register (compte utilisable immédiatement) ; l'admin peut le repasser
    // à false pour suspendre un compte. Check conditionné au rôle HEBERGEUR, sinon
    // il bloquerait les autres rôles dont compteValide est false par défaut.
    if (user.role === 'HEBERGEUR' && !user.compteValide) {
      throw new UnauthorizedException('COMPTE_EN_ATTENTE_VALIDATION');
    }

    // Trial 30j Pilotage à la première connexion. UNIQUEMENT ici (pas dans
    // consommerMagicLink ni refreshAccessToken) : un seul point d'activation,
    // et updateMany filtre par userId propriétaire — un collaborateur invité
    // (CollaborateurCentre) n'est jamais userId d'un CentreHebergement.
    if (user.role === 'HEBERGEUR') {
      await this.activerTrialPremiereConnexion(user.id);
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Active le trial 30j Pilotage sur les centres de l'hébergeur à sa première
   * connexion. Gardes du WHERE : trialStartedAt null (trial jamais consommé),
   * mollieMandatId null (pas d'abonnement payé), abonnementStatut INACTIF —
   * garde critique qui protège les clients existants en prod (leurs centres
   * ACTIF ne sont jamais touchés). Non bloquant : un échec ne doit JAMAIS
   * faire échouer le login.
   * Notif admin au format d'activerTrial() (AbonnementService non injectable
   * ici : AbonnementModule importe AuthModule, l'inverse créerait un cycle).
   */
  private async activerTrialPremiereConnexion(userId: string) {
    try {
      const now = new Date();
      const expiration = new Date(now);
      expiration.setDate(expiration.getDate() + 30);

      const { count } = await this.prisma.centreHebergement.updateMany({
        where: {
          userId,
          trialStartedAt: null,
          mollieMandatId: null,
          abonnementStatut: StatutAbonnement.INACTIF,
        },
        data: {
          planAbonnement: PlanAbonnement.PILOTAGE,
          abonnementStatut: StatutAbonnement.ACTIF,
          abonnementActifJusquAu: expiration,
          trialStartedAt: now,
        },
      });
      if (count === 0) return;

      const [user, centres] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, prenom: true, nom: true },
        }),
        this.prisma.centreHebergement.findMany({
          where: { userId, trialStartedAt: now },
          select: { nom: true },
        }),
      ]);
      const dateExp = expiration.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      for (const centre of centres) {
        await this.email.sendNotifAdmin(
          `[Admin] Nouveau trial — ${centre.nom}`,
          `<p><strong>${centre.nom}</strong> a activé un essai gratuit (30 jours Pilotage).</p>
           <table style="width:100%;border-collapse:collapse;margin:16px 0">
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
             <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user?.prenom ?? ''} ${user?.nom ?? ''} — ${user?.email ?? 'N/A'}</td></tr>
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Expiration</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateExp}</td></tr>
           </table>`,
        );
      }
    } catch (err) {
      console.error('[login] Echec activation trial première connexion', err);
    }
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
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
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
      select: { id: true, tokenVersion: true },
    });
    if (!user) throw new BadRequestException('Lien invalide ou expiré');

    const hash = await bcrypt.hash(nouveauMotDePasse, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        motDePasse: hash,
        motDePasseDefini: true,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async consommerMagicLink(token: string, res: any) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const user = await this.prisma.user.findFirst({
      where: { magicLinkToken: token, magicLinkExpires: { gte: new Date() } },
      select: { id: true, email: true, role: true, motDePasseDefini: true, tokenVersion: true },
    });
    if (!user) {
      return res.redirect(`${frontendUrl}/login?error=magic_link_expired`);
    }

    // B3 fix : ne lever QUE emailVerifie — ne pas forcer compteValide
    // (préserve la validation admin pour HEBERGEUR)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifie: true, magicLinkToken: null, magicLinkExpires: null },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion ?? 0 };
    const accessToken = this.jwt.sign(payload);
    const needsPassword = !user.motDePasseDefini;

    // Refresh token pour le magic link aussi
    const refreshToken = randomUUID();
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenExpires },
    });

    // Phase 1 4a : poser les cookies httpOnly (le hash dans l'URL reste pour backward compat)
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.redirect(
      `${frontendUrl}/auth/callback#token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&onboarding=true${needsPassword ? '&needsPassword=true' : ''}`
    );
  }

  /**
   * Génère un magic link frais pour un utilisateur et retourne l'URL.
   * Réutilisable partout (notifications, relance, etc.).
   * Chaque appel écrase le précédent (un seul magic link actif).
   */
  async genererMagicUrl(userId: string): Promise<string> {
    const magicToken = randomUUID();
    const magicExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await this.prisma.user.update({
      where: { id: userId },
      data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
    });
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    return `${frontendUrl}/auth/magic/${magicToken}`;
  }

  async refreshAccessToken(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        refreshToken: token,
        refreshTokenExpires: { gte: new Date() },
      },
      select: {
        id: true, email: true, prenom: true, nom: true, role: true,
        reseauNom: true, tokenVersion: true,
        compteValide: true,
      },
    });
    if (!user) throw new UnauthorizedException('Refresh token invalide ou expiré');

    // Gate hébergeur (cohérent avec validate)
    if (user.role === 'HEBERGEUR' && !user.compteValide) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: {
    id: string;
    email: string;
    prenom: string;
    nom: string;
    role: string;
    reseauNom?: string | null;
    tokenVersion?: number;
  }) {
    const tokenVersion = user.tokenVersion ?? 0;
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      reseau: user.reseauNom ?? null,
      tokenVersion,
    };

    // Refresh token : UUID rotatif, 30 jours, stocké en base
    const refreshToken = randomUUID();
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenExpires },
    });

    return {
      access_token: this.jwt.sign(payload),
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: user.role,
      },
    };
  }

  async definirMotDePasse(userId: string, password: string, ancienMotDePasse?: string): Promise<{ success: boolean }> {
    if (!password || password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { motDePasseDefini: true, motDePasse: true, tokenVersion: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // Si un mot de passe existe déjà → exiger l'ancien (pas de reset silencieux via JWT volé)
    if (user.motDePasseDefini) {
      if (!ancienMotDePasse) {
        throw new BadRequestException('L\'ancien mot de passe est requis.');
      }
      const isValid = await bcrypt.compare(ancienMotDePasse, user.motDePasse);
      if (!isValid) {
        throw new UnauthorizedException('Ancien mot de passe incorrect.');
      }
    }

    const hash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        motDePasse: hash,
        motDePasseDefini: true,
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      },
    });
    return { success: true };
  }
}
