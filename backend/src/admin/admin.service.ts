import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── Stats ───────────────────────────────────────────────────────────────────

  async getStats() {
    const [
      totalUtilisateurs,
      totalCentres,
      totalSejours,
      totalDevis,
      hebergeursEnAttente,
      utilisateursParRole,
      sejoursParStatut,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.centreHebergement.count(),
      this.prisma.sejour.count(),
      this.prisma.devis.count(),
      this.prisma.user.count({ where: { role: 'VENUE', compteValide: false } }),
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.sejour.groupBy({ by: ['statut'], _count: true }),
    ]);

    return {
      totalUtilisateurs,
      totalCentres,
      totalSejours,
      totalDevis,
      hebergeursEnAttente,
      utilisateursParRole: utilisateursParRole.map((r) => ({
        role: r.role,
        count: r._count,
      })),
      sejoursParStatut: sejoursParStatut.map((s) => ({
        statut: s.statut,
        count: s._count,
      })),
    };
  }

  // ─── Hébergeurs ──────────────────────────────────────────────────────────────

  async getHebergeurs(statut?: string) {
    const where: any = { role: 'VENUE' as const };
    if (statut === 'EN_ATTENTE') where.compteValide = false;
    if (statut === 'VALIDE') where.compteValide = true;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        telephone: true,
        compteValide: true,
        emailVerifie: true,
        createdAt: true,
        centres: {
          select: {
            id: true,
            nom: true,
            ville: true,
            codePostal: true,
            capacite: true,
            siret: true,
            departement: true,
            agrementEducationNationale: true,
            statut: true,
            abonnementStatut: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validerHebergeur(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { centres: { select: { id: true, nom: true, ville: true } } },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.prisma.user.update({
      where: { id },
      data: { compteValide: true },
    });

    // Activer le centre aussi
    await this.prisma.centreHebergement.updateMany({
      where: { userId: id },
      data: { statut: 'ACTIVE' },
    });

    try {
      const nomCentre = user.centres[0]?.nom ?? 'votre centre';
      await this.email.sendVenueAccountValidated(user.email, user.prenom, nomCentre);
    } catch {
      // Email non bloquant
    }

    // Créer automatiquement les demandes de devis issues d'invitations centre externe
    const centreId = user.centres[0]?.id;
    if (centreId) {
      const invitations = await this.prisma.invitationCentreExterne.findMany({
        where: { centreId, demandeCreee: false },
      });

      for (const invitation of invitations) {
        try {
          const sejour = await this.prisma.sejour.create({
            data: {
              titre: invitation.titreSejourSuggere,
              lieu: invitation.villeCentre,
              dateDebut: invitation.dateDebut,
              dateFin: invitation.dateFin,
              placesTotales: invitation.nbElevesEstime,
              placesRestantes: invitation.nbElevesEstime,
              statut: 'DRAFT',
              createurId: invitation.enseignantId,
              regionSouhaitee: `VILLE:${invitation.villeCentre}`,
            },
          });

          await this.prisma.demandeDevis.create({
            data: {
              sejourId: sejour.id,
              enseignantId: invitation.enseignantId,
              titre: invitation.titreSejourSuggere,
              dateDebut: invitation.dateDebut,
              dateFin: invitation.dateFin,
              nombreEleves: invitation.nbElevesEstime,
              villeHebergement: invitation.villeCentre,
              statut: 'OUVERTE',
              centreDestinataireId: centreId,
            },
          });

          await this.prisma.invitationCentreExterne.update({
            where: { id: invitation.id },
            data: { demandeCreee: true },
          });

          // Notifier l'enseignant
          const enseignant = await this.prisma.user.findUnique({
            where: { id: invitation.enseignantId },
            select: { email: true, prenom: true },
          });
          if (enseignant) {
            await this.email.sendGenericNotification(
              enseignant.email,
              `${invitation.nomCentre} a rejoint LIAVO — votre demande est en attente de devis`,
              `<p>Bonjour ${enseignant.prenom},</p>
               <p>Bonne nouvelle ! Le centre <strong>${invitation.nomCentre}</strong> que vous avez invité vient de rejoindre LIAVO.</p>
               <p>Une demande de devis pour le séjour <strong>${invitation.titreSejourSuggere}</strong> leur a été automatiquement transmise.</p>
               <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/teacher" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mon tableau de bord</a></p>`,
            );
          }
        } catch (err) {
          console.error('Erreur création demande depuis invitation externe', err);
          // Non bloquant — ne pas faire échouer la validation
        }
      }
    }

    return { success: true };
  }

  async refuserHebergeur(id: string, motif?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { centres: { select: { nom: true } } },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    try {
      const nomCentre = user.centres[0]?.nom ?? 'votre centre';
      await this.email.sendVenueAccountRefused(user.email, user.prenom, nomCentre, motif);
    } catch {
      // Email non bloquant
    }

    // Supprimer le centre puis l'utilisateur
    await this.prisma.centreHebergement.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    return { success: true };
  }

  // ─── Utilisateurs ────────────────────────────────────────────────────────────

  async getUtilisateurs(search?: string, role?: string) {
    const where: any = {};
    if (role) where.role = role;
    if (search && search.length >= 2) {
      where.OR = [
        { prenom: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        role: true,
        telephone: true,
        compteValide: true,
        emailVerifie: true,
        etablissementNom: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateUtilisateur(id: string, data: { role?: string; compteValide?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role && { role: data.role as any }),
        ...(data.compteValide !== undefined && { compteValide: data.compteValide }),
      },
      select: {
        id: true,
        email: true,
        prenom: true,
        nom: true,
        role: true,
        compteValide: true,
      },
    });
  }

  // ─── Centres ─────────────────────────────────────────────────────────────────

  async getCentres(search?: string) {
    const where: any = {};
    if (search && search.length >= 2) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { ville: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.centreHebergement.findMany({
      where,
      select: {
        id: true,
        nom: true,
        adresse: true,
        ville: true,
        codePostal: true,
        telephone: true,
        email: true,
        capacite: true,
        siret: true,
        departement: true,
        agrementEducationNationale: true,
        statut: true,
        abonnementStatut: true,
        reseau: true,
        createdAt: true,
        user: {
          select: { id: true, prenom: true, nom: true, email: true, compteValide: true },
        },
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ─── Réseau partenaire ──────────────────────────────────────────────────────

  async getReseauStats(reseau: string, periode?: string, nomComplet?: string) {
    let dateFrom: Date | undefined;
    const now = new Date();
    if (periode === '30j') dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (periode === '90j') dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (periode === 'saison') {
      const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      dateFrom = new Date(year, 8, 1);
    }

    const centres = await this.prisma.centreHebergement.findMany({
      where: { reseau },
      select: {
        id: true, nom: true, ville: true, departement: true,
        capacite: true, statut: true, abonnementStatut: true,
        mandatFacturationAccepte: true, siret: true,
        agrementEducationNationale: true, description: true, telephone: true,
        createdAt: true,
        devis: {
          where: dateFrom ? { createdAt: { gte: dateFrom } } : undefined,
          select: { statut: true, montantTTC: true, createdAt: true },
        },
        demandesDestinees: {
          where: dateFrom ? { createdAt: { gte: dateFrom } } : undefined,
          select: { id: true, statut: true, createdAt: true },
        },
      },
      orderBy: { nom: 'asc' },
    });

    const totalCentres = centres.length;
    const centresActifs = centres.filter(c => c.statut === 'ACTIVE').length;

    const tousLesDevis = centres.flatMap(c => c.devis);
    const toutesLesDemandes = centres.flatMap(c => c.demandesDestinees);

    const devisEnvoyes = tousLesDevis.length;
    const devisSelectionnes = tousLesDevis.filter(d => d.statut === 'SELECTIONNE').length;
    const caTotal = tousLesDevis
      .filter(d => d.statut === 'SELECTIONNE')
      .reduce((sum, d) => sum + (d.montantTTC ?? 0), 0);

    const demandesRecues = toutesLesDemandes.length;
    const tauxReponse = demandesRecues > 0
      ? Math.round((devisEnvoyes / demandesRecues) * 100)
      : 0;

    return {
      reseau,
      nomComplet: nomComplet ?? reseau,
      periode: periode ?? 'tout',
      kpis: {
        totalCentres,
        centresActifs,
        demandesRecues,
        devisEnvoyes,
        devisSelectionnes,
        caTotal,
        tauxReponse,
      },
      centres: centres.map(c => {
        const onboardingDetails = {
          profilComplet: !!(c.description && c.ville && c.telephone),
          mandatSigne: c.mandatFacturationAccepte,
          agrementRenseigne: !!c.agrementEducationNationale,
          siretRenseigne: !!c.siret,
        };
        const onboardingScore = [
          onboardingDetails.profilComplet,
          onboardingDetails.mandatSigne,
          onboardingDetails.agrementRenseigne,
          onboardingDetails.siretRenseigne,
        ].filter(Boolean).length;

        return {
          id: c.id,
          nom: c.nom,
          ville: c.ville,
          departement: c.departement,
          capacite: c.capacite,
          statut: c.statut,
          abonnementStatut: c.abonnementStatut,
          demandesRecues: c.demandesDestinees.length,
          devisEnvoyes: c.devis.length,
          devisSelectionnes: c.devis.filter(d => d.statut === 'SELECTIONNE').length,
          caGenere: c.devis
            .filter(d => d.statut === 'SELECTIONNE')
            .reduce((sum, d) => sum + (d.montantTTC ?? 0), 0),
          derniereActivite: c.devis.length > 0
            ? c.devis.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
            : c.createdAt,
          onboardingScore,
          onboardingDetails,
        };
      }),
    };
  }

  async getReseauCentreDetail(centreId: string, reseau: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { id: centreId, reseau },
      select: {
        id: true, nom: true, ville: true, departement: true, adresse: true,
        codePostal: true, telephone: true, email: true, siteWeb: true,
        capacite: true, capaciteAdultes: true, statut: true, abonnementStatut: true,
        siret: true, agrementEducationNationale: true,
        accessiblePmr: true, avisSecurite: true,
        thematiquesCentre: true, activitesCentre: true,
        periodeOuverture: true, description: true,
        mandatFacturationAccepte: true, mandatFacturationAccepteAt: true,
        imageUrl: true, createdAt: true,
        devis: {
          select: { statut: true, montantTTC: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        demandesDestinees: {
          select: { id: true, statut: true, createdAt: true, titre: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!centre) throw new NotFoundException('Centre introuvable dans ce réseau');
    return centre;
  }

  async inviterCentreReseau(reseau: string, email: string, nomCentre: string) {
    const existing = await this.prisma.invitationHebergement.findFirst({
      where: { email, utilisedAt: null },
    });
    if (existing) throw new Error('Une invitation est déjà en attente pour cet email');

    const invitation = await this.prisma.invitationHebergement.create({
      data: { email, nomCentre },
    });

    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/venue?token=${invitation.token}&reseau=${encodeURIComponent(reseau)}`;

    await this.email.sendGenericNotification(
      email,
      `Invitation à rejoindre LIAVO — Réseau ${reseau}`,
      `<p>Bonjour,</p>
       <p>Le réseau <strong>${reseau}</strong> vous invite à rejoindre la plateforme LIAVO pour gérer vos séjours scolaires.</p>
       <p>En tant que membre du réseau ${reseau}, votre centre apparaîtra automatiquement dans le tableau de bord de votre réseau dès votre inscription.</p>
       <p style="margin:24px 0">
         <a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Créer mon espace hébergeur
         </a>
       </p>
       <p style="font-size:12px;color:#666;">Ce lien est valable 30 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    );

    return { success: true, email, nomCentre };
  }

  async updateCentreReseau(centreId: string, reseau: string | null) {
    return this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: { reseau: reseau ?? null },
      select: { id: true, nom: true, reseau: true },
    });
  }
}
