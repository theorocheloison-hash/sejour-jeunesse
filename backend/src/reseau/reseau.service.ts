import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { STATUTS_DEVIS_RETENUS } from '../devis/devis-statuts.constants.js';

/**
 * Dashboards des réseaux partenaires (LMDJ, IDDJ…) : stats, demandes, fiche
 * centre, invitation d'un centre. Méthodes extraites d'AdminService (hygiène,
 * découpage par appelant réel) — corps déplacés VERBATIM, zéro changement
 * fonctionnel. Les outils d'import/dédup de catalogue (syncApidae, syncLmdj,
 * backfill EN…) restent dans AdminService : seuls des comptes ADMIN les
 * actionnent.
 */
@Injectable()
export class ReseauService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

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
        capacite: true, statut: true, userId: true,
        // Abonnement lu sur l'ORGANISATION du centre (L3c-0).
        organisation: { select: { abonnementStatut: true } },
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
    const RETENUS = new Set<string>(STATUTS_DEVIS_RETENUS);

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
          // Centre sans org → INACTIF (théorique : 0 orphelin en prod, SQL 10/08).
          abonnementStatut: c.organisation?.abonnementStatut ?? 'INACTIF',
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
        capacite: true, capaciteAdultes: true, statut: true,
        // Abonnement lu sur l'ORGANISATION du centre (L3c-0).
        organisation: { select: { abonnementStatut: true } },
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
    const RETENUS = new Set<string>(STATUTS_DEVIS_RETENUS);
    const caViaReseau = centre.devis
      .filter(
        d => RETENUS.has(d.statut)
          && !d.isComplementaire
          && (d.demande?.sourceReseau ?? '').toLowerCase() === reseau.toLowerCase(),
      )
      .reduce((sum, d) => sum + (d.montantTTC ?? 0), 0);

    // Isoler `organisation` du spread : le contrat expose la clé plate
    // abonnementStatut, jamais la structure imbriquée du select (L3c-0).
    const { organisation, ...centreSansOrg } = centre;
    return {
      ...centreSansOrg,
      // Centre sans org → INACTIF (théorique : 0 orphelin en prod, SQL 10/08).
      abonnementStatut: organisation?.abonnementStatut ?? 'INACTIF',
      caViaReseau,
    };
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
      undefined,
      undefined,
      null,
    );

    return { success: true, email, nomCentre };
  }
}
