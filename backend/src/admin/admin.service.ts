import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { FactureLiavoService } from '../facture-liavo/facture-liavo.service.js';
import { findOrCreateOrganisation } from '../organisations/organisation.helpers.js';
import { demarrerOuAlignerTrial } from '../centres/trial.helper.js';
import { MAX_PHOTOS_CENTRE } from '../centres/centre.service.js';
import { normaliserDepartement } from '../utils/departements.js';
import { calculerMontantAbonnementCents } from '../abonnements/abonnement.constants.js';

const ADMIN_FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';

// Même dataset que HebergementService.search — constante volontairement redéfinie ici.
const EN_API = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

const PRIX_MENSUEL: Record<string, number> = { ESSENTIEL: 2900, COMPLET: 4900, PILOTAGE: 6900 };
const PRIX_ANNUEL: Record<string, number> = { ESSENTIEL: 29000, COMPLET: 49000, PILOTAGE: 69000 };

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private factureLiavo: FactureLiavoService,
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
      this.prisma.user.count({ where: { role: 'HEBERGEUR', compteValide: false } }),
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
    const where: any = { role: 'HEBERGEUR' as const };
    if (statut === 'EN_ATTENTE') where.compteValide = false;
    if (statut === 'VALIDE') where.compteValide = true;

    // Abonnement lu sur l'ORGANISATION du centre (L3c-0). Réponse recomposée
    // clé par clé (users puis centres) : mêmes clés plates qu'avant la bascule,
    // la structure `organisation` du select ne fuit pas dans le contrat.
    const users = await this.prisma.user.findMany({
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
            organisation: { select: { abonnementStatut: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(u => ({
      id: u.id,
      email: u.email,
      prenom: u.prenom,
      nom: u.nom,
      telephone: u.telephone,
      compteValide: u.compteValide,
      emailVerifie: u.emailVerifie,
      createdAt: u.createdAt,
      centres: u.centres.map(c => ({
        id: c.id,
        nom: c.nom,
        ville: c.ville,
        codePostal: c.codePostal,
        capacite: c.capacite,
        siret: c.siret,
        departement: c.departement,
        agrementEducationNationale: c.agrementEducationNationale,
        statut: c.statut,
        // Centre sans org → INACTIF (théorique : 0 orphelin en prod, SQL 10/08).
        abonnementStatut: c.organisation?.abonnementStatut ?? 'INACTIF',
      })),
    }));
  }

  async validerHebergeur(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        prenom: true,
        centres: { select: { id: true, nom: true, ville: true } },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    await this.prisma.user.update({
      where: { id },
      data: { compteValide: true },
    });

    // Activer les centres ; l'essai gratuit passe par la source unique
    // (demarrerOuAlignerTrial), plus de trial divergent posé ici.
    await this.prisma.centreHebergement.updateMany({
      where: { userId: id },
      data: { statut: 'ACTIVE' },
    });

    // Essai porté par l'organisation (Lot 2e) : 1 appel par organisation dont
    // un centre vient d'être activé. Les gardes org filtrent ensuite (payante /
    // offerte / essai en cours) organisation par organisation.
    const orgsAActiver = await this.prisma.centreHebergement.findMany({
      where: { userId: id, organisationId: { not: null } },
      select: { organisationId: true },
      distinct: ['organisationId'],
    });
    for (const { organisationId } of orgsAActiver) {
      if (organisationId) await demarrerOuAlignerTrial(this.prisma, this.email, organisationId);
    }

    try {
      const nomCentre = user.centres[0]?.nom ?? 'votre centre';
      await this.email.sendHebergeurAccountValidated(user.email, user.prenom, nomCentre);
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
              typePension: [],
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
               <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/organisateur" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mon tableau de bord</a></p>`,
              undefined,
              undefined,
              null,
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
      select: {
        id: true,
        email: true,
        prenom: true,
        centres: { select: { nom: true } },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    try {
      const nomCentre = user.centres[0]?.nom ?? 'votre centre';
      await this.email.sendHebergeurAccountRefused(user.email, user.prenom, nomCentre, motif);
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
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateUtilisateur(id: string, data: { role?: string; compteValide?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role && { role: data.role as Role }),
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

    // Abonnement lu sur l'ORGANISATION du centre (L3c-0). Réponse recomposée
    // clé par clé : mêmes clés plates qu'avant la bascule, `organisation` ne
    // fuit pas dans le contrat.
    const centres = await this.prisma.centreHebergement.findMany({
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
        organisation: { select: { abonnementStatut: true } },
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
    return centres.map(c => ({
      id: c.id,
      nom: c.nom,
      adresse: c.adresse,
      ville: c.ville,
      codePostal: c.codePostal,
      telephone: c.telephone,
      email: c.email,
      capacite: c.capacite,
      siret: c.siret,
      departement: c.departement,
      agrementEducationNationale: c.agrementEducationNationale,
      statut: c.statut,
      // Centre sans org → INACTIF (théorique : 0 orphelin en prod, SQL 10/08).
      abonnementStatut: c.organisation?.abonnementStatut ?? 'INACTIF',
      reseau: c.reseau,
      createdAt: c.createdAt,
      user: c.user,
      _count: c._count,
    }));
  }

  async getAbonnements() {
    // Abonnement lu sur l'ORGANISATION du centre (L3a-bis) — une seule requête,
    // pas de N+1. Réponse recomposée : mêmes clés qu'avant la bascule, 1 ligne
    // par centre (contrat front inchangé).
    const centres = await this.prisma.centreHebergement.findMany({
      select: {
        id: true,
        nom: true,
        userId: true,
        user: { select: { email: true, prenom: true, nom: true } },
        organisation: {
          select: {
            planAbonnement: true,
            abonnement: true,
            abonnementStatut: true,
            abonnementActifJusquAu: true,
            trialStartedAt: true,
            mollieCustomerId: true,
            mollieSubscriptionId: true,
            mollieMandatId: true,
            modePaiement: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });
    return centres.map(c => ({
      id: c.id,
      nom: c.nom,
      // Centre sans org → INACTIF/DECOUVERTE (affichage honnête). Contrat inchangé.
      planAbonnement: c.organisation?.planAbonnement ?? 'DECOUVERTE',
      abonnement: c.organisation?.abonnement ?? null,
      abonnementStatut: c.organisation?.abonnementStatut ?? 'INACTIF',
      abonnementActifJusquAu: c.organisation?.abonnementActifJusquAu ?? null,
      trialStartedAt: c.organisation?.trialStartedAt ?? null,
      mollieCustomerId: c.organisation?.mollieCustomerId ?? null,
      mollieSubscriptionId: c.organisation?.mollieSubscriptionId ?? null,
      mollieMandatId: c.organisation?.mollieMandatId ?? null,
      modePaiement: c.organisation?.modePaiement ?? null,
      userId: c.userId,
      user: c.user,
    }));
  }

  regenererFactureLiavoPdf(id: string) {
    return this.factureLiavo.regenererPdf(id);
  }

  async getFacturesLiavo() {
    return this.prisma.factureLiavo.findMany({
      orderBy: { dateEmission: 'desc' },
      include: { centre: { select: { nom: true } } },
    });
  }

  async getMetriquesAbonnements() {
    const now = new Date();
    // Métriques d'abonnement comptées par ORGANISATION (L3a-bis) : une org
    // multi-centre = 1 abonnement, plus de double-comptage.
    // Garde-fou : un compte VIREMENT est payant, jamais trial (sinon
    // double-comptage type Choucas) → exclusion null-safe des VIREMENT sur les
    // trials (patron cron-alertes : un `not: 'VIREMENT'` seul exclurait les
    // NULL, c'est-à-dire les vrais essais).
    const horsVirement = {
      OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' as const } }],
    };
    // Payant = mandat Mollie OU virement admin, abonnement ACTIF.
    const wherePayant = {
      abonnementStatut: 'ACTIF' as const,
      OR: [{ mollieMandatId: { not: null } }, { modePaiement: 'VIREMENT' as const }],
    };

    const [totalCentres, trialActifs, trialExpires, aboPayes, orgsPayantes] = await Promise.all([
      // Inventaire de centres (pas d'abonnements) — inchangé.
      this.prisma.centreHebergement.count({ where: { statut: 'ACTIVE' } }),
      this.prisma.organisation.count({
        where: {
          abonnementStatut: 'ACTIF', trialStartedAt: { not: null }, mollieMandatId: null,
          abonnementActifJusquAu: { gte: now },
          AND: [horsVirement],
        },
      }),
      this.prisma.organisation.count({
        where: {
          trialStartedAt: { not: null }, mollieMandatId: null,
          OR: [{ abonnementActifJusquAu: { lt: now } }, { abonnementActifJusquAu: null }],
          AND: [horsVirement],
        },
      }),
      this.prisma.organisation.count({ where: wherePayant }),
      // MRR = somme par organisation : prix du plan + supplément multi-centre
      // (Q7 : seuls les centres ACTIVE revendiqués comptent), en centimes.
      this.prisma.organisation.findMany({
        where: wherePayant,
        select: {
          planAbonnement: true,
          abonnement: true,
          _count: {
            select: {
              centresHebergement: { where: { statut: 'ACTIVE', userId: { not: null } } },
            },
          },
        },
      }),
    ]);

    const mrrCents = orgsPayantes.reduce((sum, o) => {
      const montant = calculerMontantAbonnementCents(
        o.planAbonnement,
        o.abonnement ?? 'MENSUEL',
        o._count.centresHebergement,
      );
      return sum + (o.abonnement === 'ANNUEL' ? Math.round(montant / 12) : montant);
    }, 0);
    // mrr en euros (number), même clé/unité que le front (metriques.mrr.toFixed(2)).
    const mrr = mrrCents / 100;

    return { totalCentres, trialActifs, trialExpires, aboPayes, mrr };
  }

  // ─── Sync APIDAE ────────────────────────────────────────────────────────────
  // Variables à ajouter dans Railway : APIDAE_IDDJ_API_KEY, APIDAE_IDDJ_PROJET_ID, APIDAE_IDDJ_SELECTION_ID

  async syncApidae(reseau: string): Promise<{ created: number; updated: number; errors: number; details: string[] }> {
    const CREDENTIALS: Record<string, { apiKey: string; projetId: number; selectionId: number }> = {
      IDDJ: {
        apiKey: process.env.APIDAE_IDDJ_API_KEY ?? '',
        projetId: Number(process.env.APIDAE_IDDJ_PROJET_ID ?? 3217),
        selectionId: Number(process.env.APIDAE_IDDJ_SELECTION_ID ?? 67523),
      },
    };

    const creds = CREDENTIALS[reseau.toUpperCase()];
    if (!creds || !creds.apiKey) {
      throw new BadRequestException(`Aucune configuration APIDAE pour le réseau ${reseau}`);
    }

    const query = JSON.stringify({
      apiKey: creds.apiKey,
      projetId: creds.projetId,
      selectionIds: [creds.selectionId],
      count: 200,
      responseFields: ['@minimal', 'localisation', 'informations', 'coordonnees', 'capacites', 'presentation', 'illustrations', 'prestations', 'ouverture'],
    });

    const url = `https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException(`Erreur API APIDAE : ${res.status}`);

    const data: any = await res.json();
    const objets: any[] = data.objetsTouristiques ?? [];

    let created = 0;
    let updated = 0;
    let errors = 0;
    const details: string[] = [];

    for (const obj of objets) {
      try {
        const apidaeId = String(obj.id);
        const nom: string = obj.nom?.libelleFr ?? 'Sans nom';
        const adresse = obj.localisation?.adresse ?? {};
        const ville: string = adresse.commune?.nom ?? '';
        const codePostal: string = adresse.codePostal ?? '';

        const moyens: any[] = obj.informations?.moyensCommunication ?? [];
        const emailEntry = moyens.find((m: any) => m.type?.id === 204);
        const email: string | null = emailEntry?.coordonnees?.fr ?? null;
        const telEntry = moyens.find((m: any) => m.type?.id === 201);
        const telephone: string | null = telEntry?.coordonnees?.fr ?? null;
        const siteEntry = moyens.find((m: any) => m.type?.id === 205);
        const siteWeb: string | null = siteEntry?.coordonnees?.fr ?? null;

        const capacite: number =
          obj.capacites?.educationNationale?.personnes ??
          obj.capacites?.declarees?.personnes ??
          0;

        const capaciteAdultes: number | null =
          obj.capacites?.educationNationale?.classes ?? null;

        const description: string | null =
          (obj.presentation?.descriptifCourt?.libelleFr ?? null)?.substring(0, 2000) ?? null;

        // Galerie complète (§3.11) — dédupliquée, plafonnée comme l'upload hébergeur.
        const galerieApidae: string[] = [...new Set(
          ((obj.illustrations ?? []) as any[])
            .map((ill: any) => ill.traductionFichiers?.find((t: any) => t.locale === 'fr')?.urlDiaporama)
            .filter(Boolean) as string[]
        )].slice(0, MAX_PHOTOS_CENTRE);
        const coverApidae: string | null = galerieApidae[0] ?? null;

        const periodeOuverture: string | null =
          (obj.ouverture?.periodeEnClair?.libelleFr ?? null)?.substring(0, 255) ?? null;

        const adresseStr = (adresse.adresse1 ?? adresse.voie ?? '').substring(0, 500);

        // Département depuis le code postal (les 2 premiers chiffres)
        const cp: string = adresse.codePostal ?? '';
        const deptCode = cp.substring(0, 2);
        const DEPT_MAP: Record<string, string> = {
          '01': 'Ain', '07': 'Ardèche', '26': 'Drôme', '38': 'Isère',
          '42': 'Loire', '43': 'Haute-Loire', '63': 'Puy-de-Dôme',
          '69': 'Rhône', '73': 'Savoie', '74': 'Haute-Savoie',
          '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes',
          '06': 'Alpes-Maritimes', '13': 'Bouches-du-Rhône',
          '83': 'Var', '84': 'Vaucluse',
        };
        const departement: string = DEPT_MAP[deptCode] ?? adresse.commune?.departement?.nom ?? '';

        const activitesCentre: string[] = (obj.prestations?.equipements ?? [])
          .map((e: any) => e.libelleFr as string)
          .filter(Boolean)
          .slice(0, 10);

        const accessiblePmr: boolean =
          (obj.capacites?.hebergementCollectif?.capaciteAccueilPMI ?? 0) > 0;

        const existing = await this.prisma.centreHebergement.findFirst({
          where: { apidaeId },
        });

        if (existing) {
          if (existing.userId) {
            // Centre revendiqué : l'hébergeur est maître de ses données. On n'ENRICHIT que
            // les champs vides, jamais d'écrasement, pas de flip reseau.
            await this.prisma.centreHebergement.update({
              where: { id: existing.id },
              data: {
                ...(existing.reseau == null && { reseau }),
                ...(existing.email == null && email && { email }),
                ...(existing.telephone == null && telephone && { telephone }),
                ...(existing.siteWeb == null && siteWeb && { siteWeb }),
                ...(existing.description == null && description && { description }),
                ...(existing.periodeOuverture == null && periodeOuverture && { periodeOuverture }),
                ...(existing.capaciteAdultes == null && capaciteAdultes != null && { capaciteAdultes }),
                ...(existing.capacite === 0 && capacite > 0 && { capacite }),
                ...((existing.activitesCentre?.length ?? 0) === 0 && activitesCentre.length > 0 && { activitesCentre }),
                ...(existing.imageUrl == null && galerieApidae.length > 0 && { imageUrl: coverApidae, imagesUrls: galerieApidae }),
                ...(!existing.accessiblePmr && accessiblePmr && { accessiblePmr: true }),
              },
            });
            updated++;
            details.push(`ENRICHI (revendiqué) : ${nom} (${ville})`);
          } else {
            // Centre non revendiqué (catalogue) : refresh complet depuis APIDAE (comportement actuel).
            await this.prisma.centreHebergement.update({
              where: { id: existing.id },
              data: {
                nom,
                adresse: adresseStr,
                ville,
                codePostal,
                departement,
                email,
                telephone,
                siteWeb,
                capacite: capacite > 0 ? capacite : existing.capacite,
                capaciteAdultes: capaciteAdultes ?? existing.capaciteAdultes,
                description: description ?? existing.description,
                ...(galerieApidae.length > 0 && { imageUrl: coverApidae, imagesUrls: galerieApidae }),
                periodeOuverture: periodeOuverture ?? existing.periodeOuverture,
                activitesCentre: activitesCentre.length > 0 ? activitesCentre : existing.activitesCentre,
                accessiblePmr,
                reseau,
                source: 'APIDAE',
              },
            });
            updated++;
            details.push(`MIS À JOUR : ${nom} (${ville})`);
          }
        } else {
          await this.prisma.centreHebergement.create({
            data: {
              nom,
              adresse: adresseStr,
              ville,
              codePostal,
              departement,
              email,
              telephone,
              siteWeb,
              capacite: capacite > 0 ? capacite : 0,
              capaciteAdultes,
              description,
              imageUrl: coverApidae,
              imagesUrls: galerieApidae,
              periodeOuverture,
              activitesCentre,
              accessiblePmr,
              reseau,
              source: 'APIDAE',
              apidaeId,
              userId: null,
              statut: 'ACTIVE',
            },
          });
          created++;
          details.push(`CRÉÉ : ${nom} (${ville})`);
        }

        // Rattacher le centre à une Organisation (idempotent)
        const centreRef = existing ?? await this.prisma.centreHebergement.findFirst({ where: { apidaeId } });
        if (centreRef && !centreRef.organisationId) {
          const { organisation } = await findOrCreateOrganisation(this.prisma, {
            nom,
            adresse: adresseStr,
            codePostal,
            ville,
            departement,
            emailContact: email,
            telephoneContact: telephone,
            siteWeb,
            source: 'APIDAE',
            sourceId: apidaeId,
            typeStructure: null, // sera mis à jour post-migration
          });
          await this.prisma.centreHebergement.update({
            where: { id: centreRef.id },
            data: { organisationId: organisation.id },
          });
        }
      } catch (err: any) {
        errors++;
        details.push(`ERREUR : ${obj.nom?.libelleFr ?? obj.id} — ${err.message}`);
      }
    }

    return { created, updated, errors, details };
  }

  /**
   * Importe/met à jour les centres LMDJ scrapés depuis le site web
   * (scripts/scrape-lmdj.ts → scripts/lmdj-centres.json).
   *
   * Dédup (dans l'ordre) : apidaeId → nom+ville normalisés → email.
   * Centres avec userId (hébergeur réel) : on n'enrichit que les champs null + reseau.
   */
  async syncLmdj(data: any[]): Promise<{
    created: number;
    updated: number;
    enriched: number;
    errors: number;
    details: string[];
  }> {
    if (!Array.isArray(data)) {
      throw new BadRequestException('Le corps doit être un tableau de centres');
    }

    const normalize = (s: string): string =>
      (s ?? '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');

    /**
     * Tronque une valeur aux limites VarChar du modèle Organisation
     * (cf. schema.prisma) pour éviter l'erreur Prisma "value too long".
     * Ex. departement VarChar(10) vs "Haute-Savoie" (12 car.).
     */
    const trunc = (s: unknown, max: number): string | null => {
      if (s == null) return null;
      const str = String(s).trim();
      return str.length > max ? str.substring(0, max) : str;
    };

    let created = 0;
    let updated = 0;
    let enriched = 0;
    let errors = 0;
    const details: string[] = [];

    // Chargement de tous les centres pour le dedup en mémoire (import one-shot admin)
    interface DedupRef {
      id: string;
      nom: string;
      ville: string;
      email: string | null;
      apidaeId: string | null;
      userId: string | null;
      reseau: string | null;
      imageUrl: string | null;
      accessiblePmr: boolean;
      siteWeb: string | null;
      periodeOuverture: string | null;
      organisationId: string | null;
    }
    const allCentres: DedupRef[] = await this.prisma.centreHebergement.findMany({
      select: {
        id: true, nom: true, ville: true, email: true, apidaeId: true,
        userId: true, reseau: true, imageUrl: true, accessiblePmr: true,
        siteWeb: true, periodeOuverture: true, organisationId: true,
      },
    });
    const byApidae = new Map<string, DedupRef>();
    const byNomVille = new Map<string, DedupRef>();
    const byEmail = new Map<string, DedupRef>();
    for (const c of allCentres) {
      if (c.apidaeId) byApidae.set(c.apidaeId, c);
      byNomVille.set(`${normalize(c.nom)}|${normalize(c.ville)}`, c);
      if (c.email) byEmail.set(c.email.toLowerCase(), c);
    }

    for (const item of data) {
      try {
        const nom: string = (item.nom ?? '').toString().trim() || 'Sans nom';
        const ville: string = (item.ville ?? '').toString().trim();
        const apidaeId: string | null = item.apidaeId ? String(item.apidaeId) : null;
        const email: string | null = item.email ? String(item.email).trim().toLowerCase() : null;
        const description: string | null = item.description
          ? String(item.description).substring(0, 2000)
          : null;
        const capacite: number = typeof item.capacite === 'number' ? item.capacite : 0;
        const equipements: string[] = Array.isArray(item.equipements)
          ? item.equipements.filter((e: unknown) => typeof e === 'string').slice(0, 20)
          : [];
        const agrementEN: string | null = item.classesEN
          ? `${item.classesEN} classes`.substring(0, 50)
          : null;
        const accessiblePmr: boolean = item.accessiblePmr === true;

        // Rattache un centre à une Organisation (dédup nom+ville côté helper).
        // Champs string tronqués aux limites VarChar du modèle Organisation
        // (schema.prisma). departement = VarChar(100) → pas de troncature à 10.
        const attachOrganisation = async (centreId: string): Promise<string> => {
          const { organisation } = await findOrCreateOrganisation(this.prisma, {
            nom: nom.substring(0, 255),
            ville: ville.substring(0, 255),
            adresse: trunc(item.adresse, 500),
            codePostal: trunc(item.codePostal, 10),
            departement: item.departement ?? null,
            emailContact: trunc(email, 255),
            telephoneContact: trunc(item.telephone, 20),
            siteWeb: trunc(item.siteWeb, 500),
            source: 'RESEAU_IMPORT',
            sourceId: trunc(apidaeId, 100),
            typeStructure: null,
          });
          await this.prisma.centreHebergement.update({
            where: { id: centreId },
            data: { organisationId: organisation.id },
          });
          return organisation.id;
        };

        // ── Dédup ──
        const found: DedupRef | null =
          (apidaeId ? byApidae.get(apidaeId) : undefined) ??
          byNomVille.get(`${normalize(nom)}|${normalize(ville)}`) ??
          (email ? byEmail.get(email) : undefined) ??
          null;

        if (found) {
          if (found.userId) {
            // Hébergeur réel inscrit : ne toucher que reseau + champs null
            await this.prisma.centreHebergement.update({
              where: { id: found.id },
              data: {
                ...(found.reseau !== 'LMDJ' && { reseau: 'LMDJ' }),
                ...(found.imageUrl == null && item.imageUrl && { imageUrl: item.imageUrl }),
                ...(found.apidaeId == null && apidaeId && { apidaeId }),
                ...(found.siteWeb == null && item.siteWeb && { siteWeb: item.siteWeb }),
                ...(found.periodeOuverture == null && item.periodeOuverture && {
                  periodeOuverture: String(item.periodeOuverture).substring(0, 255),
                }),
                // accessiblePmr n'est jamais null en base : on upgrade false → true uniquement
                ...(!found.accessiblePmr && accessiblePmr && { accessiblePmr: true }),
              },
            });
            enriched++;
            details.push(`ENRICHI (utilisateur existant) : ${nom} (${ville})`);
          } else {
            // Import APIDAE/catalogue : données LMDJ plus riches → on écrase
            await this.prisma.centreHebergement.update({
              where: { id: found.id },
              data: {
                nom,
                ville,
                ...(item.departement && { departement: normaliserDepartement(item.departement) }),
                ...(item.codePostal && { codePostal: item.codePostal }),
                adresse: item.adresse ?? '',
                ...(item.telephone && { telephone: item.telephone }),
                ...(email && { email }),
                ...(item.siteWeb && { siteWeb: item.siteWeb }),
                ...(description && { description }),
                ...(capacite > 0 && { capacite }),
                ...(item.capaciteAdultes != null && { capaciteAdultes: item.capaciteAdultes }),
                ...(item.imageUrl && { imageUrl: item.imageUrl }),
                // Conserver apidaeId existant si le nouveau est null
                apidaeId: apidaeId ?? found.apidaeId,
                accessiblePmr,
                ...(equipements.length > 0 && { activitesCentre: equipements }),
                ...(agrementEN && { agrementEducationNationale: agrementEN }),
                reseau: 'LMDJ',
                source: 'LMDJ_WEB',
              },
            });
            // Centre catalogue orphelin (ex. import LMDJ précédent où la
            // création d'Organisation avait échoué) → rattachement.
            if (found.organisationId == null) {
              found.organisationId = await attachOrganisation(found.id);
            }
            updated++;
            details.push(`MIS À JOUR : ${nom} (${ville})`);
          }
        } else {
          // ── Création ──
          const centre = await this.prisma.centreHebergement.create({
            data: {
              nom,
              ville,
              departement: normaliserDepartement(item.departement),
              codePostal: item.codePostal ?? null,
              adresse: item.adresse ?? '',
              telephone: item.telephone ?? null,
              email,
              siteWeb: item.siteWeb ?? null,
              description,
              capacite,
              capaciteAdultes: item.capaciteAdultes ?? null,
              imageUrl: item.imageUrl ?? null,
              apidaeId,
              accessiblePmr,
              activitesCentre: equipements,
              agrementEducationNationale: agrementEN,
              reseau: 'LMDJ',
              source: 'LMDJ_WEB',
              statut: 'ACTIVE',
              userId: null,
              abonnementStatut: 'INACTIF',
              planAbonnement: 'DECOUVERTE',
            },
          });

          // Rattacher à une Organisation (nouveaux centres).
          const organisationId = await attachOrganisation(centre.id);

          // Ajout au cache pour dédup intra-lot (sécurité si doublon dans le JSON)
          const ref: DedupRef = {
            id: centre.id, nom, ville, email, apidaeId, userId: null,
            reseau: 'LMDJ', imageUrl: item.imageUrl ?? null, accessiblePmr,
            siteWeb: item.siteWeb ?? null, periodeOuverture: null, organisationId,
          };
          if (apidaeId) byApidae.set(apidaeId, ref);
          byNomVille.set(`${normalize(nom)}|${normalize(ville)}`, ref);
          if (email) byEmail.set(email, ref);

          created++;
          details.push(`CRÉÉ : ${nom} (${ville})`);
        }
      } catch (err: any) {
        errors++;
        details.push(`ERREUR : ${item?.nom ?? '?'} — ${err?.message ?? err}`);
      }
    }

    return { created, updated, enriched, errors, details };
  }

  /**
   * Rattache les centres LMDJ_WEB à leur fiche Éducation nationale (identifiant EN
   * → apidaeId) et enrichit les champs vides (avis sécurité, thématiques, capacité
   * adultes). Prépare la dédup catalogue (Lot 3). Idempotent : n'écrit que les
   * champs null/vides, jamais nom/ville/source/reseau.
   *
   * Garde faux-positif : similarité de Jaccard sur les tokens distinctifs
   * (ponctuation → espaces, stopwords de domaine retirés partout). RATTACHÉ auto
   * seulement si un candidat unique atteint ≥ 0.8 ; zone 0.5–0.8 (ou plusieurs
   * candidats forts) → PROPOSITION jamais écrite, avec l'identifiant EN pour
   * rattachement manuel. En cas de doute → rien n'est écrit (un faux positif
   * efface un vrai centre du catalogue, pire qu'un doublon résiduel).
   *
   * dryRun : tout le matching, aucune écriture — pour valider le rapport avant.
   */
  async backfillEducationNationale(reseau: string, dryRun: boolean): Promise<{
    dryRun: boolean;
    matched: number;
    proposed: number;
    ambiguous: number;
    notFound: number;
    errors: number;
    details: string[];
  }> {
    const STOPWORDS = new Set([
      'centre', 'chalet', 'maison', 'domaine', 'village', 'residence', 'residences',
      'vacances', 'colonie', 'gite', 'gites', 'sejour', 'sas', 'cchm', 'cap', 'france',
      'de', 'du', 'des', 'd', 'le', 'la', 'les', 'l', 'et',
    ]);
    const tokensDistinctifs = (s: string): Set<string> => {
      const bruts = (s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      const distincts = bruts.filter((t) => !STOPWORDS.has(t));
      // Jamais de Set vide (deux noms 100 % stopwords matcheraient entre eux).
      return new Set(distincts.length > 0 ? distincts : bruts);
    };
    const jaccard = (a: Set<string>, b: Set<string>): number => {
      if (a.size === 0 || b.size === 0) return 0;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      return inter / (a.size + b.size - inter);
    };

    const centres = await this.prisma.centreHebergement.findMany({
      where: { source: 'LMDJ_WEB', userId: null, reseau },
      select: {
        id: true, nom: true, ville: true, codePostal: true,
        apidaeId: true, avisSecurite: true, capaciteAdultes: true, thematiquesCentre: true,
      },
    });

    let matched = 0;
    let proposed = 0;
    let ambiguous = 0;
    let notFound = 0;
    let errors = 0;
    const details: string[] = [];

    // Un seul fetch EN par code postal distinct.
    const parCp = new Map<string, typeof centres>();
    for (const c of centres) {
      const cp = (c.codePostal ?? '').trim();
      if (!cp) {
        notFound++;
        details.push(`INTROUVABLE : ${c.nom} (CP manquant)`);
        continue;
      }
      const groupe = parCp.get(cp) ?? [];
      groupe.push(c);
      parCp.set(cp, groupe);
    }

    for (const [cp, groupe] of parCp) {
      let candidats: { identifiant: string; nom: string; tokens: Set<string>; avis: string | null; thematiques: string[]; litsAdultes: number | null }[];
      try {
        const params = new URLSearchParams({
          where: `nom_du_lieu_d_accueil_code_postal="${cp}"`,
          limit: '50',
        });
        const res = await fetch(`${EN_API}?${params}`);
        if (!res.ok) throw new Error(`API EN ${res.status}`);
        const data: any = await res.json();
        candidats = ((data.results ?? []) as any[])
          .filter((r) => r.identifiant && r.nom_de_la_structure_d_accueil_et_d_hebergement_fr)
          .map((r) => ({
            identifiant: String(r.identifiant),
            nom: String(r.nom_de_la_structure_d_accueil_et_d_hebergement_fr),
            tokens: tokensDistinctifs(String(r.nom_de_la_structure_d_accueil_et_d_hebergement_fr)),
            avis: r.avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite
              ? String(r.avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite)
              : null,
            thematiques: Array.isArray(r.thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement)
              ? (r.thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement as any[]).filter((t) => typeof t === 'string')
              : [],
            litsAdultes: typeof r.nombre_de_lits_pour_les_adultes_assurant_l_encadrement === 'number'
              ? r.nombre_de_lits_pour_les_adultes_assurant_l_encadrement
              : null,
          }));
      } catch (err: any) {
        errors += groupe.length;
        details.push(`ERREUR : CP ${cp} — ${err?.message ?? err} (${groupe.length} centre(s) non traités)`);
        continue;
      }

      for (const centre of groupe) {
        try {
          const cible = tokensDistinctifs(centre.nom);
          const scores = candidats
            .map((k) => ({ candidat: k, score: jaccard(cible, k.tokens) }))
            .sort((a, b) => b.score - a.score);
          const meilleur = scores[0];
          const forts = scores.filter((s) => s.score >= 0.8);

          if (meilleur && meilleur.score >= 0.8 && forts.length === 1) {
            const match = meilleur.candidat;
            if (!dryRun) {
              const data: Record<string, unknown> = {};
              if (centre.apidaeId == null) data.apidaeId = match.identifiant;
              if (centre.avisSecurite == null && match.avis) data.avisSecurite = match.avis.substring(0, 50);
              if ((centre.thematiquesCentre?.length ?? 0) === 0 && match.thematiques.length > 0) data.thematiquesCentre = match.thematiques;
              if (centre.capaciteAdultes == null && match.litsAdultes != null) data.capaciteAdultes = match.litsAdultes;
              if (Object.keys(data).length > 0) {
                await this.prisma.centreHebergement.update({ where: { id: centre.id }, data });
              }
            }
            matched++;
            details.push(`RATTACHÉ : ${centre.nom} (${cp}) → EN ${match.identifiant}`);
          } else if (meilleur && meilleur.score >= 0.5) {
            // Score intermédiaire OU plusieurs candidats forts : décision humaine.
            proposed++;
            details.push(`PROPOSITION : ${centre.nom} (${cp}) → EN ${meilleur.candidat.identifiant} "${meilleur.candidat.nom}" (score ${meilleur.score.toFixed(2)})`);
          } else if (candidats.length > 0) {
            ambiguous++;
            details.push(`AMBIGU : ${centre.nom} (${cp}) — candidats : [${candidats.map((k) => k.nom).join(', ')}]`);
          } else {
            notFound++;
            details.push(`INTROUVABLE : ${centre.nom} (${cp})`);
          }
        } catch (err: any) {
          errors++;
          details.push(`ERREUR : ${centre.nom} (${cp}) — ${err?.message ?? err}`);
        }
      }
    }

    return { dryRun, matched, proposed, ambiguous, notFound, errors, details };
  }

  async bulkInviteApidae(reseau: string): Promise<{
    sent: number;
    skipped: number;
    details: string[];
  }> {
    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        reseau,
        source: 'APIDAE',
        userId: null,
        email: { not: null },
      },
      select: { id: true, nom: true, email: true },
    });

    let sent = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const centre of centres) {
      if (!centre.email) { skipped++; continue; }

      const existingInvitation = await this.prisma.invitationHebergement.findFirst({
        where: { email: centre.email, utilisedAt: null },
      });
      if (existingInvitation) {
        skipped++;
        details.push(`IGNORÉ (invitation déjà active) : ${centre.nom}`);
        continue;
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: centre.email },
        select: { id: true },
      });
      if (existingUser) {
        skipped++;
        details.push(`IGNORÉ (compte déjà existant) : ${centre.nom}`);
        continue;
      }

      try {
        const invitation = await this.prisma.invitationHebergement.create({
          data: { email: centre.email, nomCentre: centre.nom },
        });

        const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/hebergeur?token=${invitation.token}&reseau=${encodeURIComponent(reseau)}`;

        await this.email.sendGenericNotification(
          centre.email,
          `Votre centre ${centre.nom} vous attend sur LIAVO`,
          `<p>Bonjour,</p>
           <p>Votre centre <strong>${centre.nom}</strong> est déjà référencé sur LIAVO, la plateforme de coordination des séjours scolaires.</p>
           <p>Il vous suffit de créer votre compte pour :</p>
           <ul style="margin:12px 0;padding-left:20px;font-size:14px;color:#374151;">
             <li style="margin-bottom:6px;">Recevoir les demandes de devis des enseignants sur votre zone</li>
             <li style="margin-bottom:6px;">Gérer vos disponibilités et envoyer vos devis en ligne</li>
             <li style="margin-bottom:6px;">Accéder à votre profil déjà enrichi (photos, capacités, description)</li>
           </ul>
           <p style="margin:24px 0">
             <a href="${lien}"
                style="display:inline-block;background:#1B4060;color:#fff;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
               Créer mon compte →
             </a>
           </p>
           <p style="font-size:12px;color:#9ca3af;">
             Ce lien est personnel et valable 30 jours. Questions : <a href="mailto:contact@liavo.fr">contact@liavo.fr</a>
           </p>`,
          undefined,
          undefined,
          null,
        );

        sent++;
        details.push(`ENVOYÉ : ${centre.nom} → ${centre.email}`);
      } catch (err: any) {
        skipped++;
        details.push(`ERREUR : ${centre.nom} — ${err.message}`);
      }
    }

    return { sent, skipped, details };
  }

  async updateCentreReseau(centreId: string, reseau: string | null) {
    return this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: { reseau: reseau ?? null },
      select: { id: true, nom: true, reseau: true },
    });
  }

  // ─── Centres PENDING à valider (hébergeurs déjà validés) ──────────────────────

  /**
   * Centres en attente de validation individuelle : statut PENDING dont
   * l'organisation a déjà au moins un membership VALIDE (= hébergeur validé qui
   * ajoute un centre). Les premiers claims (org pas encore validée) restent gérés
   * via la liste des claims (memberships), pas ici — évite les doublons.
   */
  async getCentresPending() {
    return this.prisma.centreHebergement.findMany({
      where: {
        statut: 'PENDING',
        organisation: { memberships: { some: { claimStatut: 'VALIDE' } } },
      },
      select: {
        id: true,
        nom: true,
        ville: true,
        claimDocumentUrl: true,
        claimSubmittedAt: true,
        user: { select: { id: true, prenom: true, nom: true, email: true } },
        organisation: { select: { id: true, nom: true, siren: true } },
      },
      orderBy: { claimSubmittedAt: 'desc' },
    });
  }

  /** Active un centre PENDING (validation admin) + notifie l'hébergeur. */
  async activerCentre(centreId: string) {
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      include: { user: { select: { email: true, prenom: true } } },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.statut === 'ACTIVE') return { success: true, alreadyActive: true };

    await this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: { statut: 'ACTIVE' },
    });

    // Essai porté par l'organisation (Lot 2e) : l'org du centre qu'on vient
    // d'activer. Un centre sans organisation (théorique, 0 en prod) → pas d'essai.
    if (centre.organisationId) {
      await demarrerOuAlignerTrial(this.prisma, this.email, centre.organisationId);
    } else {
      console.log('[activerCentre] centre', centre.id, 'sans organisation — essai non démarré');
    }

    if (centre.user?.email) {
      this.email.sendGenericNotification(
        centre.user.email,
        `Votre centre ${centre.nom} a été activé`,
        `<p>Bonjour ${centre.user.prenom ?? ''},</p>
         <p>Votre centre <strong>${centre.nom}</strong> a été validé et est désormais actif sur LIAVO.</p>
         <p><a href="${ADMIN_FRONTEND_URL}/dashboard/hebergeur">Accéder à mon espace →</a></p>`,
        undefined,
        undefined,
        null,
      ).catch((err) => console.error('[activerCentre] échec email hébergeur', err));
    }

    return { success: true };
  }

  /**
   * Refuse un centre PENDING (validation admin) : passage en SUSPENDED + email
   * motivé à l'hébergeur — le refus silencieux laissait l'hébergeur bloqué sans
   * explication (même modèle que claimService.refuserClaim).
   */
  async refuserCentre(centreId: string, motif?: string) {
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      include: { user: { select: { email: true, prenom: true } } },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.statut !== 'PENDING') throw new ForbiddenException("Ce centre n'est pas en attente");

    await this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: { statut: 'SUSPENDED' },
    });

    if (centre.user?.email) {
      this.email.sendGenericNotification(
        centre.user.email,
        `Votre centre ${centre.nom} n'a pas pu être validé`,
        `<p>Bonjour ${centre.user.prenom ?? ''},</p>
         <p>Votre centre <strong>${centre.nom}</strong> n'a pas pu être validé
         pour la raison suivante :</p>
         <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
           ${motif || 'Document non conforme'}
         </blockquote>
         <p>Si vous pensez qu'il s'agit d'une erreur, contactez-nous à
         <a href="mailto:contact@liavo.fr">contact@liavo.fr</a>.</p>`,
        undefined,
        undefined,
        null,
      ).catch((err) => console.error('[refuserCentre] échec email hébergeur', err));
    }

    return { message: 'Centre refusé.' };
  }

  // ─── Activité (feed + santé clients + KPIs) ────────────────────────────────

  async getActivite() {
    const now = new Date();
    const since7d = new Date(now);
    since7d.setDate(since7d.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Section 1 : Feed d'activité (7 derniers jours) ──

    const [newUsers, newCentres, newSejours, newDemandes, newDevis] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: since7d } },
        select: { id: true, email: true, prenom: true, nom: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.centreHebergement.findMany({
        where: { createdAt: { gte: since7d } },
        select: {
          id: true, nom: true, ville: true, createdAt: true,
          user: { select: { email: true, prenom: true, nom: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sejour.findMany({
        where: { createdAt: { gte: since7d } },
        select: {
          id: true, titre: true, dateDebut: true, dateFin: true, placesTotales: true,
          modeGestion: true, natureSejour: true, statut: true, createdAt: true,
          clientNom: true, clientEmail: true, clientOrganisation: true, clientTelephone: true,
          hebergementSelectionne: { select: { id: true, nom: true } },
          createur: { select: { email: true, prenom: true, nom: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.demandeDevis.findMany({
        where: { createdAt: { gte: since7d } },
        select: {
          id: true, titre: true, nombreEleves: true, createdAt: true,
          dateDebut: true, dateFin: true, villeHebergement: true, statut: true,
          centreDestinataire: { select: { id: true, nom: true } },
          enseignant: { select: { email: true, prenom: true, nom: true } },
          _count: { select: { devis: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devis.findMany({
        where: { createdAt: { gte: since7d } },
        select: {
          id: true, montantTotal: true, statut: true, createdAt: true, numeroDevis: true,
          centre: { select: { id: true, nom: true } },
          sejourDirect: { select: { id: true, titre: true } },
          demande: { select: { id: true, titre: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type FeedEvent = { type: string; date: Date; data: Record<string, any> };
    const feed: FeedEvent[] = [
      ...newUsers.map(u => ({
        type: 'NOUVEAU_COMPTE' as const,
        date: u.createdAt,
        data: { email: u.email, prenom: u.prenom, nom: u.nom, role: u.role },
      })),
      ...newCentres.map(c => ({
        type: 'NOUVEAU_CENTRE' as const,
        date: c.createdAt,
        data: { nom: c.nom, ville: c.ville, proprietaire: c.user ? `${c.user.prenom} ${c.user.nom}` : null },
      })),
      ...newSejours.map(s => ({
        type: 'NOUVEAU_SEJOUR' as const,
        date: s.createdAt,
        data: {
          titre: s.titre, dateDebut: s.dateDebut, dateFin: s.dateFin,
          places: s.placesTotales, mode: s.modeGestion, nature: s.natureSejour, statut: s.statut,
          centre: s.hebergementSelectionne?.nom ?? null,
          createur: s.createur ? `${s.createur.prenom} ${s.createur.nom} (${s.createur.role})` : null,
          clientNom: s.clientNom ?? null,
          clientEmail: s.clientEmail ?? null,
          clientOrganisation: s.clientOrganisation ?? null,
        },
      })),
      ...newDemandes.map(d => ({
        type: 'NOUVELLE_DEMANDE' as const,
        date: d.createdAt,
        data: {
          titre: d.titre, nbEleves: d.nombreEleves,
          dateDebut: d.dateDebut, dateFin: d.dateFin,
          ville: d.villeHebergement, statut: d.statut,
          nbDevisRecus: (d as any)._count?.devis ?? 0,
          centre: d.centreDestinataire?.nom ?? null,
          enseignant: `${d.enseignant.prenom} ${d.enseignant.nom}`,
          enseignantEmail: d.enseignant.email,
        },
      })),
      ...newDevis.map(d => ({
        type: 'NOUVEAU_DEVIS' as const,
        date: d.createdAt,
        data: {
          numero: d.numeroDevis, montant: Number(d.montantTotal), statut: d.statut,
          centre: d.centre?.nom ?? null,
          sejour: d.sejourDirect?.titre ?? d.demande?.titre ?? null,
        },
      })),
    ];
    feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    const feedLimited = feed.slice(0, 100);

    // ── Section 2 : Santé clients (centres actifs avec propriétaire) ──

    const centresActifs = await this.prisma.centreHebergement.findMany({
      where: { statut: 'ACTIVE', userId: { not: null } },
      include: {
        // Abonnement lu sur l'ORGANISATION du centre (L3a-bis), fallback org-null
        // aligné getMesCentres.
        organisation: {
          select: {
            planAbonnement: true,
            trialStartedAt: true,
            mollieMandatId: true,
            abonnementActifJusquAu: true,
            abonnementStatut: true,
          },
        },
        sejoursSelectionne: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        devis: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { sejoursSelectionne: true, devis: true },
        },
      },
      orderBy: { nom: 'asc' },
    });

    const santeClients = centresActifs.map(c => {
      const lastSejourDate = c.sejoursSelectionne[0]?.createdAt ?? null;
      const lastDevisDate = c.devis[0]?.createdAt ?? null;
      const dates = [lastSejourDate, lastDevisDate].filter(Boolean) as Date[];
      const derniereActivite = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

      const joursDepuisActivite = derniereActivite
        ? Math.floor((now.getTime() - derniereActivite.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let signal: 'vert' | 'jaune' | 'rouge' | 'gris' = 'gris';
      if (joursDepuisActivite !== null) {
        if (joursDepuisActivite <= 3) signal = 'vert';
        else if (joursDepuisActivite <= 7) signal = 'jaune';
        else signal = 'rouge';
      }

      const isTrial = !!c.organisation?.trialStartedAt && !c.organisation?.mollieMandatId;
      const expiration = c.organisation?.abonnementActifJusquAu ?? null;
      const joursRestants = expiration
        ? Math.ceil((new Date(expiration).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: c.id,
        nom: c.nom,
        plan: c.organisation?.planAbonnement ?? 'DECOUVERTE',
        isTrial,
        abonnementStatut: c.organisation?.abonnementStatut ?? 'INACTIF',
        joursRestants,
        expiration,
        derniereActivite,
        joursDepuisActivite,
        signal,
        nbSejours: c._count.sejoursSelectionne,
        nbDevis: c._count.devis,
      };
    });

    // ── Section 3 : KPIs mois en cours ──

    const [sejoursCreesMois, devisCreesMois, centresAvecSejour, totalCentresAvecUser] = await Promise.all([
      this.prisma.sejour.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.devis.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.centreHebergement.count({
        where: { statut: 'ACTIVE', userId: { not: null }, sejoursSelectionne: { some: {} } },
      }),
      this.prisma.centreHebergement.count({
        where: { statut: 'ACTIVE', userId: { not: null } },
      }),
    ]);

    const tauxActivation = totalCentresAvecUser > 0
      ? Math.round((centresAvecSejour / totalCentresAvecUser) * 100)
      : 0;

    return {
      feed: feedLimited,
      santeClients,
      kpis: {
        sejoursCreesMois,
        devisCreesMois,
        centresActifs: totalCentresAvecUser,
        centresAvecSejour,
        tauxActivation,
      },
    };
  }

  // ─── Facturation manuelle (virement administratif, hors Mollie) ────────────

  async facturerCentre(body: {
    centreId: string;
    plan: string;
    frequence: string;
    destinataireNom?: string;
    destinataireAdresse?: string;
    destinataireSiret?: string;
    destinataireEmail?: string;
  }) {
    const { centreId, plan, frequence } = body;
    const destinataire = body.destinataireNom ? {
      nom: body.destinataireNom,
      adresse: body.destinataireAdresse ?? null,
      siret: body.destinataireSiret ?? null,
      email: body.destinataireEmail ?? null,
    } : null;

    if (!['ESSENTIEL', 'COMPLET', 'PILOTAGE'].includes(plan)) {
      throw new BadRequestException('Plan invalide');
    }
    if (!['MENSUEL', 'ANNUEL'].includes(frequence)) {
      throw new BadRequestException('Fréquence invalide');
    }

    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      include: {
        user: { select: { email: true, prenom: true, nom: true } },
        organisation: { select: { abonnementActifJusquAu: true } },
      },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (!centre.organisationId || !centre.organisation) {
      throw new ConflictException("Ce centre n'est rattaché à aucune organisation — facturation impossible");
    }

    const montant = frequence === 'ANNUEL' ? PRIX_ANNUEL[plan] : PRIX_MENSUEL[plan];

    // Calculer l'expiration : renouvellement = prolonger depuis la date de fin
    // actuelle si elle est encore dans le futur ; sinon repartir d'aujourd'hui.
    const now = new Date();
    const finActuelle = centre.organisation.abonnementActifJusquAu ? new Date(centre.organisation.abonnementActifJusquAu) : null;
    const base = finActuelle && finActuelle > now ? finActuelle : now;
    const expiration = new Date(base);
    if (frequence === 'ANNUEL') {
      expiration.setFullYear(expiration.getFullYear() + 1);
    } else {
      expiration.setMonth(expiration.getMonth() + 1);
    }

    // Activer le plan sur l'ORGANISATION, unique porteur de l'état d'abonnement
    // (L3c). Chemin manuel hors Mollie → toujours VIREMENT : exclut le centre
    // des alertes d'essai du cron (10.1a).
    // Supplément multi-centre = L2d (le montant reste le prix plan sec ici).
    const dataAbo = {
      planAbonnement: plan as any,
      abonnement: frequence as any,
      abonnementStatut: 'ACTIF' as const,
      abonnementActifJusquAu: expiration,
      modePaiement: 'VIREMENT' as const,
    };
    await this.prisma.organisation.update({ where: { id: centre.organisationId }, data: dataAbo });

    // Émettre la facture LIAVO (PDF + email) — effet de bord, après commit.
    const facture = await this.factureLiavo.emettre(centreId, montant, plan, frequence, null, destinataire);

    return facture;
  }

  // Facturation d'une période explicite en mois (décision 10/08/2026) : une seule
  // facture couvrant N mois au tarif mensuel, avec expiration POSÉE = fin de
  // période (jamais max(base,now)+durée — un renouvellement relatif décalerait
  // une base déjà alignée). Cas d'usage : Choucas 5 mois août→déc 2026 = 345€,
  // expiration 31/12/2026. Le libellé de la facture porte la période ; nbMois
  // n'est pas recoupé avec l'écart calendaire (outil admin, le libellé fait foi).
  async facturerCentrePeriode(body: {
    centreId: string;
    plan: string;
    nbMois: number;
    periodeDebut: string;
    periodeFin: string;
    destinataireNom?: string;
    destinataireAdresse?: string;
    destinataireSiret?: string;
    destinataireEmail?: string;
  }) {
    const { centreId, plan, nbMois } = body;
    const destinataire = body.destinataireNom ? {
      nom: body.destinataireNom,
      adresse: body.destinataireAdresse ?? null,
      siret: body.destinataireSiret ?? null,
      email: body.destinataireEmail ?? null,
    } : null;

    if (PRIX_MENSUEL[plan] === undefined) {
      throw new BadRequestException('Plan invalide');
    }
    if (!Number.isInteger(nbMois) || nbMois < 1 || nbMois > 12) {
      throw new BadRequestException('Nombre de mois invalide (entier entre 1 et 12)');
    }
    const periodeDebut = new Date(body.periodeDebut);
    const periodeFin = new Date(body.periodeFin);
    if (Number.isNaN(periodeDebut.getTime()) || Number.isNaN(periodeFin.getTime())) {
      throw new BadRequestException('Période invalide (dates attendues au format ISO yyyy-mm-dd)');
    }
    if (periodeFin <= periodeDebut) {
      throw new BadRequestException('La fin de période doit être postérieure au début');
    }

    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      include: {
        user: { select: { email: true, prenom: true, nom: true } },
        organisation: { select: { abonnementActifJusquAu: true } },
      },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (!centre.organisationId || !centre.organisation) {
      throw new ConflictException("Ce centre n'est rattaché à aucune organisation — facturation impossible");
    }

    const montant = nbMois * PRIX_MENSUEL[plan];

    // Activer le plan sur l'ORGANISATION, unique porteur de l'état d'abonnement
    // (L3c) — write unique, aucun write centre, trialStartedAt non touché.
    await this.prisma.organisation.update({
      where: { id: centre.organisationId },
      data: {
        planAbonnement: plan as any,
        abonnement: 'MENSUEL' as any,
        abonnementStatut: 'ACTIF' as const,
        abonnementActifJusquAu: periodeFin,
        modePaiement: 'VIREMENT' as const,
      },
    });

    // timeZone UTC : les ISO date-only sont parsées à minuit UTC, un rendu en
    // fuseau local pourrait afficher la veille.
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    const libelle = `Abonnement LIAVO ${plan} — période ${fmt(periodeDebut)} → ${fmt(periodeFin)} (${nbMois} mois)`;

    // Émettre la facture LIAVO (PDF + email) — effet de bord, après commit.
    // organisationId passé explicitement (aligné chemin webhook, pré-L4).
    const facture = await this.factureLiavo.emettre(
      centreId, montant, plan, 'MENSUEL', null, destinataire, centre.organisationId, libelle,
    );

    return facture;
  }

  async genererDevisLiavo(body: {
    centreId: string;
    plan: string;
    frequence: string;
    destinataireNom: string;
    destinataireAdresse?: string;
    destinataireSiret?: string;
    destinataireEmail?: string;
  }) {
    if (!['ESSENTIEL', 'COMPLET', 'PILOTAGE'].includes(body.plan)) {
      throw new BadRequestException('Plan invalide');
    }
    if (!['MENSUEL', 'ANNUEL'].includes(body.frequence)) {
      throw new BadRequestException('Fréquence invalide');
    }

    return this.factureLiavo.genererDevisLiavo(
      body.centreId,
      body.plan,
      body.frequence,
      {
        nom: body.destinataireNom,
        adresse: body.destinataireAdresse ?? null,
        siret: body.destinataireSiret ?? null,
        email: body.destinataireEmail ?? null,
      },
    );
  }
}
