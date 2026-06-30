import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { FactureLiavoService } from '../facture-liavo/facture-liavo.service.js';
import { findOrCreateOrganisation } from '../organisations/organisation.helpers.js';
import { trialExpiration } from '../centres/trial.helper.js';
import { normaliserDepartement } from '../utils/departements.js';

const ADMIN_FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';

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

    // Activer le centre aussi + démarrer l'essai gratuit 30j (plan COMPLET)
    await this.prisma.centreHebergement.updateMany({
      where: { userId: id },
      data: {
        statut: 'ACTIVE',
        planAbonnement: 'COMPLET',
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: trialExpiration(),
      },
    });

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

  async getAbonnements() {
    return this.prisma.centreHebergement.findMany({
      select: {
        id: true,
        nom: true,
        planAbonnement: true,
        abonnement: true,
        abonnementStatut: true,
        abonnementActifJusquAu: true,
        trialStartedAt: true,
        mollieCustomerId: true,
        mollieSubscriptionId: true,
        mollieMandatId: true,
        userId: true,
        user: { select: { email: true, prenom: true, nom: true } },
      },
      orderBy: { nom: 'asc' },
    });
  }

  async getFacturesLiavo() {
    return this.prisma.factureLiavo.findMany({
      orderBy: { dateEmission: 'desc' },
      include: { centre: { select: { nom: true } } },
    });
  }

  async getMetriquesAbonnements() {
    const now = new Date();
    const [totalCentres, trialActifs, trialExpires, aboPayes, aboActifsPayes] = await Promise.all([
      this.prisma.centreHebergement.count({ where: { statut: 'ACTIVE' } }),
      this.prisma.centreHebergement.count({
        where: {
          abonnementStatut: 'ACTIF', trialStartedAt: { not: null }, mollieMandatId: null,
          abonnementActifJusquAu: { gte: now },
        },
      }),
      this.prisma.centreHebergement.count({
        where: {
          trialStartedAt: { not: null }, mollieMandatId: null,
          OR: [{ abonnementActifJusquAu: { lt: now } }, { abonnementActifJusquAu: null }],
        },
      }),
      this.prisma.centreHebergement.count({
        where: { mollieMandatId: { not: null }, abonnementStatut: 'ACTIF' },
      }),
      // MRR = somme des prix mensuels des abonnements actifs payés
      this.prisma.centreHebergement.findMany({
        where: { mollieMandatId: { not: null }, abonnementStatut: 'ACTIF' },
        select: { planAbonnement: true, abonnement: true },
      }),
    ]);

    const PRIX_MENSUEL_MAP: Record<string, number> = { ESSENTIEL: 29, COMPLET: 49, PILOTAGE: 69 };
    const mrr = aboActifsPayes.reduce((sum, c) => {
      const prix = PRIX_MENSUEL_MAP[c.planAbonnement] ?? 0;
      return sum + (c.abonnement === 'ANNUEL' ? Math.round(prix * 100 / 12) / 100 : prix);
    }, 0);

    return { totalCentres, trialActifs, trialExpires, aboPayes, mrr: Math.round(mrr * 100) / 100 };
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
        capacite: true, statut: true, abonnementStatut: true, userId: true,
        mandatFacturationAccepte: true, siret: true,
        agrementEducationNationale: true, description: true, telephone: true,
        createdAt: true,
        devis: {
          where: dateFrom ? { createdAt: { gte: dateFrom } } : undefined,
          select: { statut: true, montantTTC: true, isComplementaire: true, createdAt: true, demande: { select: { sourceReseau: true } } },
        },
        demandesDestinees: {
          where: dateFrom ? { createdAt: { gte: dateFrom } } : undefined,
          select: { id: true, statut: true, createdAt: true },
        },
      },
      orderBy: { nom: 'asc' },
    });

    const totalCentres = centres.length;
    // "Actif" = un hébergeur a créé un compte et revendiqué ce centre (userId non null).
    // Les centres importés (APIDAE/scraping) sans compte restent dans totalCentres seulement.
    const centresActifs = centres.filter(c => c.statut === 'ACTIVE' && c.userId !== null).length;

    const tousLesDevis = centres.flatMap(c => c.devis);
    const toutesLesDemandes = centres.flatMap(c => c.demandesDestinees);

    // Un devis facturé (acompte/solde) est toujours du CA confirmé → on l'inclut au même
    // titre que SELECTIONNE/SIGNE_DIRECTION dans tous les calculs de devis « retenus ».
    const RETENUS = new Set(['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE']);

    const devisEnvoyes = tousLesDevis.length;
    const devisSelectionnes = tousLesDevis.filter(d => RETENUS.has(d.statut)).length;
    const caTotal = tousLesDevis
      .filter(d => RETENUS.has(d.statut))
      .reduce((sum, d) => sum + (d.montantTTC ?? 0), 0);

    const demandesRecues = toutesLesDemandes.length;
    const tauxReponse = demandesRecues > 0
      ? Math.round((devisEnvoyes / demandesRecues) * 100)
      : 0;

    // ── KPIs par source réseau (sourceReseau = slug 'lmdj' ; reseauNom = 'LMDJ' → insensitive) ──

    const demandesSourceReseau = await this.prisma.demandeDevis.findMany({
      where: {
        sourceReseau: { equals: reseau, mode: 'insensitive' },
        ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
      },
      select: { id: true, devis: { select: { statut: true, montantTTC: true, isComplementaire: true } } },
    });
    const demandesReseau = demandesSourceReseau.length;
    const devisRetenusReseau = demandesSourceReseau
      .flatMap(d => d.devis)
      .filter(dv => RETENUS.has(dv.statut) && !dv.isComplementaire);
    const devisReseau = devisRetenusReseau.length;
    const caReseau = devisRetenusReseau.reduce((sum, dv) => sum + (dv.montantTTC ?? 0), 0);
    const tauxConversionReseau = demandesReseau > 0
      ? Math.round((devisReseau / demandesReseau) * 100)
      : 0;

    const enseignantsReseau = await this.prisma.user.findMany({
      where: {
        sourceReseau: { equals: reseau, mode: 'insensitive' },
        ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
      },
      select: { _count: { select: { sejoursCreer: true } } },
    });
    const enseignantsAcquis = enseignantsReseau.length;
    const enseignantsFidelises = enseignantsReseau.filter(u => u._count.sejoursCreer >= 2).length;

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
        demandesReseau,
        devisReseau,
        caReseau,
        tauxConversionReseau,
        enseignantsAcquis,
        enseignantsFidelises,
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
          demandesReseau: c.devis.filter(
            d => (d.demande?.sourceReseau ?? '').toLowerCase() === reseau.toLowerCase(),
          ).length,
          devisEnvoyes: c.devis.length,
          devisSelectionnes: c.devis.filter(d => RETENUS.has(d.statut)).length,
          // CA réellement généré VIA le réseau : devis retenus (hors complémentaires)
          // dont la demande provient bien de ce réseau (et non tout le CA du centre).
          caViaReseau: c.devis
            .filter(
              d => RETENUS.has(d.statut)
                && !d.isComplementaire
                && (d.demande?.sourceReseau ?? '').toLowerCase() === reseau.toLowerCase(),
            )
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

  async getReseauDemandes(reseau: string, periode?: string) {
    let dateFrom: Date | undefined;
    const now = new Date();
    if (periode === '30j') dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (periode === '90j') dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (periode === 'saison') {
      const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      dateFrom = new Date(year, 8, 1);
    }

    const demandes = await this.prisma.demandeDevis.findMany({
      where: {
        sourceReseau: { equals: reseau, mode: 'insensitive' },
        ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
      },
      select: {
        id: true, createdAt: true, statut: true, titre: true,
        dateDebut: true, dateFin: true, moisSouhaite: true, anneeSouhaitee: true,
        dureeNuits: true, nombreAccompagnateurs: true,
        departementsCibles: true, regionCible: true, description: true,
        typePension: true, transportAller: true, transportSurPlace: true,
        heureArrivee: true, heureDepart: true, budgetMaxParEleve: true,
        activitesSouhaitees: true, informationsComplementaires: true, dateButoireReponse: true,
        sejour: {
          select: {
            placesTotales: true, niveauClasse: true, typeContexte: true,
            ageMin: true, ageMax: true, projetEducatif: true, thematiquesPedagogiques: true,
          },
        },
        enseignant: {
          select: {
            id: true, prenom: true, nom: true, email: true, telephone: true,
            memberships: {
              where: { isPrimary: true },
              select: { organisation: { select: { nom: true, ville: true, uai: true, typeStructure: true } } },
              take: 1,
            },
          },
        },
        devis: {
          select: {
            statut: true, montantTTC: true, createdAt: true,
            centre: { select: { nom: true, ville: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return demandes.map(d => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      statut: d.statut,
      titre: d.titre,
      dateDebut: d.dateDebut ? d.dateDebut.toISOString() : null,
      dateFin: d.dateFin ? d.dateFin.toISOString() : null,
      moisSouhaite: d.moisSouhaite,
      anneeSouhaitee: d.anneeSouhaitee,
      dureeNuits: d.dureeNuits,
      placesTotales: d.sejour?.placesTotales ?? 0,
      nombreAccompagnateurs: d.nombreAccompagnateurs,
      niveauClasse: d.sejour?.niveauClasse ?? null,
      typeContexte: d.sejour?.typeContexte ?? 'SCOLAIRE',
      departementsCibles: d.departementsCibles,
      regionCible: d.regionCible,
      description: d.description,
      typePension: d.typePension,
      transportAller: d.transportAller,
      transportSurPlace: d.transportSurPlace,
      heureArrivee: d.heureArrivee,
      heureDepart: d.heureDepart,
      budgetMaxParEleve: d.budgetMaxParEleve,
      activitesSouhaitees: d.activitesSouhaitees,
      informationsComplementaires: d.informationsComplementaires,
      dateButoireReponse: d.dateButoireReponse ? d.dateButoireReponse.toISOString() : null,
      ageMin: d.sejour?.ageMin ?? null,
      ageMax: d.sejour?.ageMax ?? null,
      projetEducatif: d.sejour?.projetEducatif ?? null,
      thematiquesPedagogiques: d.sejour?.thematiquesPedagogiques ?? [],
      enseignant: {
        id: d.enseignant.id,
        prenom: d.enseignant.prenom,
        nom: d.enseignant.nom,
        email: d.enseignant.email,
        telephone: d.enseignant.telephone,
      },
      organisation: d.enseignant.memberships[0]
        ? {
            nom: d.enseignant.memberships[0].organisation.nom,
            ville: d.enseignant.memberships[0].organisation.ville,
            uai: d.enseignant.memberships[0].organisation.uai,
            typeStructure: d.enseignant.memberships[0].organisation.typeStructure ?? null,
          }
        : null,
      nombreReponses: d.devis.length,
      reponses: d.devis.map(dv => ({
        centreNom: dv.centre.nom,
        centreVille: dv.centre.ville,
        statut: dv.statut,
        montantTTC: dv.montantTTC,
        dateReponse: dv.createdAt.toISOString(),
      })),
    }));
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
          select: { statut: true, montantTTC: true, isComplementaire: true, createdAt: true, demande: { select: { sourceReseau: true } } },
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

    // CA généré via le réseau sur les devis retournés (retenus, hors complémentaires,
    // dont la demande provient bien de ce réseau).
    const RETENUS = new Set(['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE']);
    const caViaReseau = centre.devis
      .filter(
        d => RETENUS.has(d.statut)
          && !d.isComplementaire
          && (d.demande?.sourceReseau ?? '').toLowerCase() === reseau.toLowerCase(),
      )
      .reduce((sum, d) => sum + (d.montantTTC ?? 0), 0);

    return { ...centre, caViaReseau };
  }

  async inviterCentreReseau(reseau: string, email: string, nomCentre: string) {
    const existing = await this.prisma.invitationHebergement.findFirst({
      where: { email, utilisedAt: null },
    });
    if (existing) throw new Error('Une invitation est déjà en attente pour cet email');

    const invitation = await this.prisma.invitationHebergement.create({
      data: { email, nomCentre },
    });

    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/hebergeur?token=${invitation.token}&reseau=${encodeURIComponent(reseau)}`;

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

        const imageUrl: string | null =
          obj.illustrations?.[0]?.traductionFichiers?.find(
            (t: any) => t.locale === 'fr'
          )?.urlDiaporama ?? null;

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
              imageUrl: imageUrl ?? existing.imageUrl,
              periodeOuverture: periodeOuverture ?? existing.periodeOuverture,
              activitesCentre: activitesCentre.length > 0 ? activitesCentre : existing.activitesCentre,
              accessiblePmr,
              reseau,
              source: 'APIDAE',
            },
          });
          updated++;
          details.push(`MIS À JOUR : ${nom} (${ville})`);
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
              imageUrl,
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

    if (centre.user?.email) {
      this.email.sendGenericNotification(
        centre.user.email,
        `Votre centre ${centre.nom} a été activé`,
        `<p>Bonjour ${centre.user.prenom ?? ''},</p>
         <p>Votre centre <strong>${centre.nom}</strong> a été validé et est désormais actif sur LIAVO.</p>
         <p><a href="${ADMIN_FRONTEND_URL}/dashboard/hebergeur">Accéder à mon espace →</a></p>`,
      ).catch((err) => console.error('[activerCentre] échec email hébergeur', err));
    }

    return { success: true };
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

      const isTrial = !!c.trialStartedAt && !c.mollieMandatId;
      const joursRestants = c.abonnementActifJusquAu
        ? Math.ceil((new Date(c.abonnementActifJusquAu).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: c.id,
        nom: c.nom,
        plan: c.planAbonnement,
        isTrial,
        abonnementStatut: c.abonnementStatut,
        joursRestants,
        expiration: c.abonnementActifJusquAu,
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

  async facturerCentre(centreId: string, plan: string, frequence: string) {
    if (!['ESSENTIEL', 'COMPLET', 'PILOTAGE'].includes(plan)) {
      throw new BadRequestException('Plan invalide');
    }
    if (!['MENSUEL', 'ANNUEL'].includes(frequence)) {
      throw new BadRequestException('Fréquence invalide');
    }

    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const montant = frequence === 'ANNUEL' ? PRIX_ANNUEL[plan] : PRIX_MENSUEL[plan];

    // Calculer l'expiration
    const now = new Date();
    const expiration = new Date(now);
    if (frequence === 'ANNUEL') {
      expiration.setFullYear(expiration.getFullYear() + 1);
    } else {
      expiration.setMonth(expiration.getMonth() + 1);
    }

    // Activer le plan
    await this.prisma.centreHebergement.update({
      where: { id: centreId },
      data: {
        planAbonnement: plan as any,
        abonnement: frequence as any,
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: expiration,
      },
    });

    // Émettre la facture LIAVO (PDF + email)
    const facture = await this.factureLiavo.emettre(centreId, montant, plan, frequence, null);

    return facture;
  }
}
