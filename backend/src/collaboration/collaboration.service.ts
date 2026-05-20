import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { CreatePlanningDto } from './dto/create-planning.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';

@Injectable()
export class CollaborationService {
  private readonly planningJobs = new Map<string, {
    status: 'pending' | 'done' | 'error';
    result?: any[];
    error?: string;
  }>();

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  private async notifierOrganisateur(
    sejour: { createurId: string | null; titre: string; createur?: { email: string; prenom: string; nom: string } | null },
    actionAuteurId: string,
    sujet: string,
    corps: string,
  ): Promise<void> {
    if (!sejour.createurId || sejour.createurId === actionAuteurId) return;
    if (!sejour.createur?.email) return;
    try {
      await this.email.sendGenericNotification(
        sejour.createur.email,
        sujet,
        corps,
      );
    } catch { /* non bloquant */ }
  }

  /** Vérifie que le séjour est en CONVENTION et que l'utilisateur y a accès */
  async verifyAccess(sejourId: string, userId: string, role?: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        hebergementSelectionne: true,
        createur: { select: { id: true, email: true, prenom: true, nom: true } },
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (!['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut)) {
      throw new ForbiddenException('Le séjour n\'est pas en statut CONVENTION');
    }

    const isCreateur = sejour.createurId === userId;
    const isHebergeur = sejour.hebergementSelectionne?.userId === userId;

    const isDirector = role === 'SIGNATAIRE';

    const accompagnateurAcces = await this.prisma.accompagnateurMission.findFirst({
      where: {
        sejourId,
        userId,
        accesCollaboratif: true,
      },
      select: { roleCollaboratif: true },
    });

    if (!isCreateur && !isHebergeur && !isDirector && !accompagnateurAcces) {
      throw new ForbiddenException('Vous n\'avez pas accès à cet espace collaboratif');
    }

    return { ...sejour, roleCollaboratif: accompagnateurAcces?.roleCollaboratif ?? null };
  }

  // ── Infos séjour ──────────────────────────────────────────────

  async getSejourInfo(sejourId: string, userId: string, role?: string) {
    const sejour = await this.verifyAccess(sejourId, userId, role);

    const full = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: { select: { id: true, prenom: true, nom: true, email: true } },
        hebergementSelectionne: { select: { id: true, nom: true, ville: true, userId: true } },
      },
    });

    return full;
  }

  // ── Messages ──────────────────────────────────────────────────

  async getMessages(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.message.findMany({
      where: { sejourId },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(sejourId: string, userId: string, dto: CreateMessageDto, role?: string) {
    const sejour = await this.verifyAccess(sejourId, userId, role);
    if (sejour.roleCollaboratif === 'LECTURE') {
      throw new ForbiddenException('Accès en lecture seule');
    }
    const message = await this.prisma.message.create({
      data: {
        sejourId,
        auteurId: userId,
        contenu: dto.contenu,
      },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    this.notifierOrganisateur(
      sejour,
      userId,
      `Nouveau message sur votre séjour — ${sejour.titre}`,
      `<p>Bonjour ${sejour.createur?.prenom ?? ''},</p>
       <p>Un nouveau message a été posté sur l'espace collaboratif de votre séjour <strong>${sejour.titre}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/dashboard/sejour/${sejour.id}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir le message
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Pour ne plus recevoir ces notifications, répondez à cet email avec "Se désabonner".</p>`,
    ).catch(() => {});

    return message;
  }

  // ── Planning ──────────────────────────────────────────────────

  async getPlanning(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.planningActivite.findMany({
      where: { sejourId },
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    });
  }

  async createPlanning(sejourId: string, userId: string, dto: CreatePlanningDto, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.planningActivite.create({
      data: {
        sejourId,
        date: new Date(dto.date),
        heureDebut: dto.heureDebut,
        heureFin: dto.heureFin,
        titre: dto.titre,
        description: dto.description,
        responsable: dto.responsable,
        couleur: dto.couleur,
        estManuelle: dto.estManuelle ?? true,
        estCollective: dto.estCollective ?? false,
      },
    });
  }

  async deletePlanning(sejourId: string, userId: string, planningId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const item = await this.prisma.planningActivite.findUnique({ where: { id: planningId } });
    if (!item || item.sejourId !== sejourId) {
      throw new NotFoundException('Activité introuvable');
    }
    return this.prisma.planningActivite.delete({ where: { id: planningId } });
  }

  // ── Documents ─────────────────────────────────────────────────

  async getDocuments(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.documentSejour.findMany({
      where: { sejourId },
      include: {
        uploader: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(sejourId: string, userId: string, dto: CreateDocumentDto, file?: Express.Multer.File, role?: string) {
    const sejour = await this.verifyAccess(sejourId, userId, role);
    if (sejour.roleCollaboratif === 'LECTURE') {
      throw new ForbiddenException('Accès en lecture seule');
    }

    let url = dto.url ?? '';
    if (file) {
      url = await this.storage.upload(file, 'documents');
    }

    const document = await this.prisma.documentSejour.create({
      data: {
        sejourId,
        uploaderId: userId,
        nom: dto.nom,
        type: dto.type,
        url,
      },
      include: {
        uploader: { select: { id: true, prenom: true, nom: true } },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    this.notifierOrganisateur(
      sejour,
      userId,
      `Nouveau document sur votre séjour — ${sejour.titre}`,
      `<p>Bonjour ${sejour.createur?.prenom ?? ''},</p>
       <p>Un nouveau document <strong>${dto.nom}</strong> a été ajouté sur l'espace collaboratif de votre séjour <strong>${sejour.titre}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/dashboard/sejour/${sejour.id}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir le document
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Pour ne plus recevoir ces notifications, répondez à cet email avec "Se désabonner".</p>`,
    ).catch(() => {});

    return document;
  }

  async getDocumentsCentre(sejourId: string, userId: string, role?: string) {
    const sejour = await this.verifyAccess(sejourId, userId, role);

    if (!sejour.hebergementSelectionneId) return [];

    return this.prisma.document.findMany({
      where: { centreId: sejour.hebergementSelectionneId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Participants (autorisations parentales) ──────────────────

  async getParticipants(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      select: {
        id: true,
        eleveNom: true,
        elevePrenom: true,
        parentEmail: true,
        signeeAt: true,
        taille: true,
        poids: true,
        pointure: true,
        regimeAlimentaire: true,
        niveauSki: true,
        infosMedicales: true,
        documentMedicalUrl: true,
        nomParent: true,
        telephoneUrgence: true,
        attestationAssuranceUrl: true,
        eleveDateNaissance: true,
        moyenPaiement: true,
        paiementValide: true,
        datePaiement: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Budget prévisionnel ──────────────────────────────────────

  async getBudgetData(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);

    const demande = await this.prisma.demandeDevis.findFirst({
      where: { sejourId },
      include: {
        devis: {
          where: { statut: 'SELECTIONNE' },
          include: {
            lignes: true,
            centre: {
              select: {
                nom: true,
                ville: true,
                adresse: true,
                codePostal: true,
                siret: true,
                telephone: true,
                email: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        titre: true,
        dateDebut: true,
        dateFin: true,
        placesTotales: true,
        createur: {
          select: {
            id: true, prenom: true, nom: true, email: true, telephone: true,
            memberships: {
              where: { isPrimary: true },
              select: {
                organisation: { select: { nom: true, ville: true, uai: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    const orgaCreateur = sejour?.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;

    const devis = demande?.devis?.[0] ?? null;

    const lignesCompl = await this.prisma.ligneBudgetComplementaire.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'asc' },
    });
    const recettes = await this.prisma.recetteBudget.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'asc' },
    });

    return { sejour, devis, lignesCompl, recettes, orgaCreateur };
  }

  async addLigneCompl(sejourId: string, userId: string, data: { categorie: string; description: string; montant: number }, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.ligneBudgetComplementaire.create({
      data: { sejourId, ...data },
    });
  }

  async deleteLigneCompl(sejourId: string, userId: string, ligneId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.ligneBudgetComplementaire.delete({ where: { id: ligneId } });
  }

  async addRecette(sejourId: string, userId: string, data: { source: string; montant: number }, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.recetteBudget.create({
      data: { sejourId, ...data },
    });
  }

  async deleteRecette(sejourId: string, userId: string, recetteId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.recetteBudget.delete({ where: { id: recetteId } });
  }

  // ── Vue hébergeur : mes séjours en convention ─────────────────

  async getMesSejoursConvention(userId: string) {
    const centres = await this.prisma.centreHebergement.findMany({
      where: { userId },
      select: { id: true },
    });
    const centreIds = centres.map((c) => c.id);

    if (centreIds.length === 0) return [];

    return this.prisma.sejour.findMany({
      where: {
        statut: { in: ['CONVENTION', 'SIGNE_DIRECTION'] },
        hebergementSelectionneId: { in: centreIds },
      },
      include: {
        createur: { select: { prenom: true, nom: true } },
        hebergementSelectionne: { select: { nom: true } },
        planningActivites: {
          orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getActivitesCatalogue(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);

    // Trouver le devis sélectionné pour ce séjour
    const demande = await this.prisma.demandeDevis.findFirst({
      where: { sejourId },
      include: {
        devis: {
          where: { statut: 'SELECTIONNE' },
          include: { lignes: { select: { description: true } } },
          take: 1,
        },
      },
    });

    const lignesDevis = demande?.devis?.[0]?.lignes ?? [];
    if (lignesDevis.length === 0) return [];

    // Descriptions des lignes du devis (noms des produits facturés)
    const nomsLignes = lignesDevis.map(l => l.description.toLowerCase().trim());

    // Récupérer les produits ACTIVITE du catalogue dont le nom
    // correspond à une ligne du devis
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: { hebergementSelectionneId: true },
    });

    if (!sejour?.hebergementSelectionneId) return [];

    const produits = await this.prisma.produitCatalogue.findMany({
      where: {
        centreId: sejour.hebergementSelectionneId,
        type: 'ACTIVITE',
        actif: true,
      },
      select: { id: true, nom: true, description: true, type: true, unite: true },
      orderBy: { nom: 'asc' },
    });

    // Filtrer : garder seulement les produits dont le nom matche
    // une ligne du devis (comparaison insensible à la casse)
    return produits.filter(p =>
      nomsLignes.some(n =>
        n.includes(p.nom.toLowerCase().trim()) ||
        p.nom.toLowerCase().trim().includes(n)
      )
    );
  }

  // ── Groupes séjour ────────────────────────────────────────────

  async getGroupes(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.groupeSejour.findMany({
      where: { sejourId },
      include: {
        eleves: {
          include: {
            autorisation: {
              select: { id: true, eleveNom: true, elevePrenom: true, signeeAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createGroupe(sejourId: string, userId: string, dto: {
    nom: string;
    couleur: string;
    taille: number;
  }, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.groupeSejour.create({
      data: { sejourId, nom: dto.nom, couleur: dto.couleur, taille: dto.taille },
      include: { eleves: true },
    });
  }

  async updateGroupe(sejourId: string, userId: string, groupeId: string, dto: {
    nom?: string;
    couleur?: string;
    taille?: number;
  }, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const g = await this.prisma.groupeSejour.findUnique({ where: { id: groupeId } });
    if (!g || g.sejourId !== sejourId) throw new NotFoundException('Groupe introuvable');
    return this.prisma.groupeSejour.update({
      where: { id: groupeId },
      data: dto,
      include: { eleves: { include: { autorisation: { select: { id: true, eleveNom: true, elevePrenom: true, signeeAt: true } } } } },
    });
  }

  async deleteGroupe(sejourId: string, userId: string, groupeId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const g = await this.prisma.groupeSejour.findUnique({ where: { id: groupeId } });
    if (!g || g.sejourId !== sejourId) throw new NotFoundException('Groupe introuvable');
    return this.prisma.groupeSejour.delete({ where: { id: groupeId } });
  }

  async affecterEleve(sejourId: string, userId: string, groupeId: string, autorisationId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    // Retirer l'élève de son groupe actuel s'il en a un
    await this.prisma.eleveGroupe.deleteMany({ where: { autorisationId } });
    // Affecter au nouveau groupe
    return this.prisma.eleveGroupe.create({
      data: { groupeId, autorisationId },
    });
  }

  async retirerEleve(sejourId: string, userId: string, autorisationId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    await this.prisma.eleveGroupe.deleteMany({ where: { autorisationId } });
  }

  async proposerGroupes(sejourId: string, userId: string, role?: string) {
    const sejour = await this.verifyAccess(sejourId, userId, role);

    // Récupérer la demande de devis pour avoir nombreEleves et nombreAccompagnateurs
    const demande = await this.prisma.demandeDevis.findFirst({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
    const nombreEleves = demande?.nombreEleves ?? sejour.placesTotales;
    const nombreAccompagnateurs = demande?.nombreAccompagnateurs ?? sejour.nombreAccompagnateurs ?? 1;

    // Récupérer les activités du catalogue avec capaciteParGroupe
    const centreId = sejour.hebergementSelectionneId;
    if (!centreId) return { groupes: [], tailleGroupe: nombreEleves, nombreGroupes: 1 };

    const activites = await this.prisma.produitCatalogue.findMany({
      where: { centreId, type: 'ACTIVITE', actif: true, capaciteParGroupe: { not: null } },
      select: { capaciteParGroupe: true, encadrementParGroupe: true },
    });

    // Algorithme LCM pour trouver la taille optimale des groupes
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

    let tailleOptimale = nombreEleves;
    if (activites.length > 0) {
      const capacites = activites
        .map(a => a.capaciteParGroupe!)
        .filter(c => c > 0);
      if (capacites.length > 0) {
        // Choisir la plus petite capacité d'activité >= 6
        // C'est la taille de groupe la plus naturelle métier :
        // elle correspond directement à ce qu'un moniteur peut prendre,
        // et le surplus est absorbé dans le dernier groupe
        const capacitesValides = capacites.filter(c => c >= 6).sort((a, b) => a - b);
        if (capacitesValides.length > 0) {
          tailleOptimale = capacitesValides[0];
        } else {
          tailleOptimale = Math.min(...capacites);
        }
      }
    }

    const nombreGroupes = Math.floor(nombreEleves / tailleOptimale);
    const surplus = nombreEleves % tailleOptimale;
    const couleurs = ['#16a34a', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#374151'];

    // surplus élèves sont ajoutés au dernier groupe (ex: 50 élèves / 7 = 6 groupes de 7 + 1 groupe de 8)
    const groupes = Array.from({ length: nombreGroupes }, (_, i) => {
      const taille = (i === nombreGroupes - 1 && surplus > 0)
        ? tailleOptimale + surplus
        : tailleOptimale;
      return { nom: `Groupe ${i + 1}`, couleur: couleurs[i % couleurs.length], taille };
    });

    return { groupes, tailleGroupe: tailleOptimale, nombreGroupes, nombreEleves, nombreAccompagnateurs };
  }

  async cloturerInscriptions(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    return this.prisma.sejour.update({
      where: { id: sejourId },
      data: { inscriptionsCloturees: true },
    });
  }

  async genererPlanningIA(sejourId: string, userId: string, role?: string, debutActivites?: string, finActivites?: string): Promise<{ jobId: string }> {
    if (role !== 'HEBERGEUR') throw new ForbiddenException('Seul l\'hébergeur peut générer le planning');

    const sejour = await this.verifyAccess(sejourId, userId, role);

    const demande = await this.prisma.demandeDevis.findFirst({
      where: { sejourId },
      include: {
        devis: {
          where: { statut: 'SELECTIONNE' },
          include: {
            lignes: { select: { description: true, quantite: true, prixUnitaire: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const devisSelectionne = demande?.devis?.[0];
    if (!devisSelectionne) {
      throw new Error('Aucun devis sélectionné — impossible de générer le planning');
    }

    const centreId = sejour.hebergementSelectionneId;
    if (!centreId) throw new Error('Centre introuvable');

    const activitesCatalogue = await this.prisma.produitCatalogue.findMany({
      where: { centreId, type: 'ACTIVITE', actif: true },
      select: { id: true, nom: true, capaciteParGroupe: true, simultaneitePossible: true, dureeMinutes: true, nbMoniteursMax: true },
    });

    // Filtrer les activités du devis
    const activitesRotation = activitesCatalogue
      .filter(a => devisSelectionne.lignes.some(l =>
        l.description.toLowerCase().includes(a.nom.toLowerCase()) ||
        a.nom.toLowerCase().includes(l.description.toLowerCase())
      ));

    if (activitesRotation.length === 0) throw new Error('Aucune activité du catalogue ne correspond aux lignes du devis');

    const groupes = await this.prisma.groupeSejour.findMany({
      where: { sejourId },
      select: { id: true, nom: true, couleur: true, taille: true },
      orderBy: { nom: 'asc' },
    });

    if (groupes.length === 0) throw new Error('Aucun groupe défini pour ce séjour');

    const activitesManuelles = await this.prisma.planningActivite.findMany({
      where: { sejourId, estManuelle: true },
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    });

    // Exclure de la rotation les activités déjà placées manuellement
    const nomsActivitesManuelles = new Set(
      activitesManuelles.map(a => {
        const nom = a.titre.includes(' — ') ? a.titre.split(' — ')[0].trim() : a.titre.trim();
        return nom.toLowerCase();
      })
    );
    const activitesRotationFiltrees = activitesRotation.filter(a =>
      !nomsActivitesManuelles.has(a.nom.toLowerCase().trim())
    );
    if (activitesRotationFiltrees.length === 0) {
      throw new Error('Toutes les activités sont déjà placées manuellement — rien à générer.');
    }

    // ── Calculer le nb de groupes simultanés par activité ─────────────────────
    // nbGroupesSimultanes(activite) = nbMoniteursMax ?? 1
    const nbGroupesSimultanesMin = Math.min(
      ...activitesRotationFiltrees.map(a => Math.max(1, a.nbMoniteursMax ?? 1))
    );
    // Taille des clusters = min sur toutes les activités pour cohérence de la rotation
    const nbGroupesParCluster = Math.max(1, nbGroupesSimultanesMin);

    // ── Construire les clusters ───────────────────────────────────────────────
    // Répartition uniforme : floor(n/k) par cluster, les premiers clusters prennent 1 de plus si reste
    const nbClustersTotal = Math.ceil(groupes.length / nbGroupesParCluster);
    const clusters: Array<typeof groupes> = [];
    let offset = 0;
    for (let c = 0; c < nbClustersTotal; c++) {
      const restant = groupes.length - offset;
      const clustersRestants = nbClustersTotal - c;
      const taille = Math.ceil(restant / clustersRestants);
      clusters.push(groupes.slice(offset, offset + taille));
      offset += taille;
    }
    const nbClusters = clusters.length;
    const nbActivites = activitesRotationFiltrees.length;

    // ── Helpers horaires ─────────────────────────────────────────────────────
    const toMin = (hh: string): number => {
      const [h, m] = hh.split(':').map(Number);
      return h * 60 + m;
    };
    const toHHMM = (mins: number): string => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // ── Construire les jours disponibles ──────────────────────────────────────
    const dateDebutStr = sejour.dateDebut.toISOString().split('T')[0];
    const dateFinStr = sejour.dateFin.toISOString().split('T')[0];
    const heureDebutGlobal = debutActivites?.split('T')[1]?.substring(0, 5) ?? '09:00';
    const heureFinGlobal = finActivites?.split('T')[1]?.substring(0, 5) ?? '18:00';

    const jours: string[] = [];
    const cursorDate = new Date(dateDebutStr + 'T12:00:00Z');
    const finDate = new Date(dateFinStr + 'T12:00:00Z');
    while (cursorDate <= finDate) {
      jours.push(cursorDate.toISOString().split('T')[0]);
      cursorDate.setDate(cursorDate.getDate() + 1);
    }

    // ── Calculer les fenêtres libres par jour ──────────────────────────────
    type Fenetre = { heureDebut: string; heureFin: string; dureeMin: number };

    const fenetresParJour = new Map<string, Fenetre[]>();
    for (const jour of jours) {
      const estPremierJour = jour === jours[0];
      const estDernierJour = jour === jours[jours.length - 1];
      const debutJour = toMin(estPremierJour ? heureDebutGlobal : '09:00');
      const finJour = toMin(estDernierJour ? heureFinGlobal : '18:00');

      const manuelsJour = activitesManuelles
        .filter(a => a.date.toISOString().split('T')[0] === jour)
        .map(a => ({ debut: toMin(a.heureDebut), fin: toMin(a.heureFin) }));

      const bloques = [
        { debut: 12 * 60, fin: 14 * 60 },
        ...manuelsJour,
      ].filter(b => b.debut < finJour && b.fin > debutJour)
        .sort((a, b) => a.debut - b.debut);

      const fenetres: Fenetre[] = [];
      let cur = debutJour;
      for (const bloque of bloques) {
        if (cur < bloque.debut) {
          fenetres.push({ heureDebut: toHHMM(cur), heureFin: toHHMM(bloque.debut), dureeMin: bloque.debut - cur });
        }
        cur = Math.max(cur, bloque.fin);
      }
      if (cur < finJour) {
        fenetres.push({ heureDebut: toHHMM(cur), heureFin: toHHMM(finJour), dureeMin: finJour - cur });
      }
      fenetresParJour.set(jour, fenetres);
    }

    // ── Pool de créneaux disponibles ───────────────────────────────────────
    type Slot = { jour: string; fenetre: Fenetre };
    const slots: Slot[] = [];
    for (const jour of jours) {
      for (const f of fenetresParJour.get(jour) ?? []) {
        slots.push({ jour, fenetre: f });
      }
    }

    if (slots.length < nbActivites) {
      throw new Error(`Pas assez de créneaux : ${nbActivites} tours nécessaires, ${slots.length} créneaux disponibles. Élargissez la plage horaire.`);
    }

    // ── Rotation round-robin : clusters × activités ────────────────────────
    type EntreePlanning = {
      groupeId: string;
      couleur: string;
      titre: string;
      date: string;
      heureDebut: string;
      heureFin: string;
    };
    const entrees: EntreePlanning[] = [];
    const slotsUtilises = new Set<number>();

    const abrégerGroupe = (nom: string): string =>
      nom.replace(/^Groupe\s+/i, 'G');

    for (let tour = 0; tour < nbActivites; tour++) {
      // Durée max requise pour ce tour
      const dureeMaxTour = Math.max(
        ...clusters.map((_, ci) => {
          const actIdx = (ci + tour) % nbActivites;
          return activitesRotationFiltrees[actIdx].dureeMinutes ?? 120;
        })
      );

      // Chercher le premier slot libre avec assez de durée
      let slotIdx = -1;
      for (let i = 0; i < slots.length; i++) {
        if (!slotsUtilises.has(i) && slots[i].fenetre.dureeMin >= dureeMaxTour) {
          slotIdx = i; break;
        }
      }
      // Fallback : premier slot libre quelle que soit la durée
      if (slotIdx === -1) {
        for (let i = 0; i < slots.length; i++) {
          if (!slotsUtilises.has(i)) { slotIdx = i; break; }
        }
      }
      if (slotIdx === -1) continue;
      slotsUtilises.add(slotIdx);
      const slot = slots[slotIdx];

      for (let ci = 0; ci < nbClusters; ci++) {
        const actIdx = (ci + tour) % nbActivites;
        const activite = activitesRotationFiltrees[actIdx];
        const duree = Math.min(activite.dureeMinutes ?? 120, slot.fenetre.dureeMin);
        const heureDebut = slot.fenetre.heureDebut;
        const heureFin = toHHMM(toMin(heureDebut) + duree);
        for (const groupe of clusters[ci]) {
          entrees.push({
            groupeId: groupe.id,
            couleur: groupe.couleur,
            titre: `${activite.nom} — ${abrégerGroupe(groupe.nom)}`,
            date: slot.jour,
            heureDebut,
            heureFin,
          });
        }
      }
    }

    // ── Persister en base ─────────────────────────────────────────────────
    const jobId = `${sejourId}-${Date.now()}`;
    this.planningJobs.set(jobId, { status: 'pending' });

    (async () => {
      try {
        await this.prisma.planningActivite.deleteMany({ where: { sejourId, estManuelle: false } });
        const created = await Promise.all(
          entrees.map(e =>
            this.prisma.planningActivite.create({
              data: {
                sejourId,
                date: new Date(e.date + 'T12:00:00Z'),
                heureDebut: e.heureDebut,
                heureFin: e.heureFin,
                titre: e.titre,
                couleur: e.couleur,
                groupeId: e.groupeId,
                estManuelle: false,
              },
            })
          )
        );
        this.planningJobs.set(jobId, { status: 'done', result: created });
      } catch (err) {
        this.planningJobs.set(jobId, { status: 'error', error: String(err) });
      }
    })();

    return { jobId };
  }

  async getPlanningGenerationStatus(jobId: string, userId: string, role?: string): Promise<{
    status: 'pending' | 'done' | 'error';
    result?: any[];
    error?: string;
  }> {
    const job = this.planningJobs.get(jobId);
    if (!job) return { status: 'error', error: 'Job introuvable' };
    return job;
  }

  // ── Journal de séjour ─────────────────────────────────────────

  async getJournal(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.postJournal.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
        photos: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async createJournalPost(
    sejourId: string,
    userId: string,
    role: string | undefined,
    contenu: string,
    files: Express.Multer.File[],
  ) {
    const sejour = await this.verifyAccess(sejourId, userId, role);
    if (sejour.roleCollaboratif === 'LECTURE') {
      throw new ForbiddenException('Accès en lecture seule');
    }
    if (!contenu || !contenu.trim()) {
      throw new ForbiddenException('Le contenu ne peut pas être vide');
    }

    const post = await this.prisma.postJournal.create({
      data: { sejourId, auteurId: userId, contenu: contenu.trim() },
    });

    for (let i = 0; i < files.length && i < 6; i++) {
      const url = await this.storage.upload(files[i], `journal/${sejourId}`);
      await this.prisma.photoJournal.create({
        data: { postId: post.id, url, ordre: i },
      });
    }

    const fullPost = await this.prisma.postJournal.findUnique({
      where: { id: post.id },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
        photos: { orderBy: { ordre: 'asc' } },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    this.notifierOrganisateur(
      sejour,
      userId,
      `Nouvelle publication sur votre séjour — ${sejour.titre}`,
      `<p>Bonjour ${sejour.createur?.prenom ?? ''},</p>
       <p>Une nouvelle publication a été ajoutée dans le journal de votre séjour <strong>${sejour.titre}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/dashboard/sejour/${sejour.id}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir la publication
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Pour ne plus recevoir ces notifications, répondez à cet email avec "Se désabonner".</p>`,
    ).catch(() => {});

    return fullPost;
  }

  async notifierPlanningMisAJour(sejourId: string, userId: string) {
    const sejour = await this.verifyAccess(sejourId, userId, 'HEBERGEUR');

    if (!sejour.createurId || !sejour.createur?.email) {
      throw new NotFoundException('Organisateur introuvable');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    await this.email.sendGenericNotification(
      sejour.createur.email,
      `Le planning de votre séjour a été mis à jour — ${sejour.titre}`,
      `<p>Bonjour ${sejour.createur.prenom ?? ''},</p>
       <p>L'hébergeur a mis à jour le planning de votre séjour <strong>${sejour.titre}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/dashboard/sejour/${sejour.id}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir le planning
         </a>
       </p>`,
    );

    return { success: true };
  }

  async deleteJournalPost(sejourId: string, postId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const post = await this.prisma.postJournal.findUnique({
      where: { id: postId },
      include: { photos: true },
    });
    if (!post || post.sejourId !== sejourId) throw new NotFoundException('Post introuvable');
    if (post.auteurId !== userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres posts');
    }

    for (const photo of post.photos) {
      await this.storage.delete(photo.url);
    }

    await this.prisma.postJournal.delete({ where: { id: postId } });
    return { deleted: true };
  }

  async updateInfosSejour(
    sejourId: string,
    dto: { titre?: string; dateDebut?: string; dateFin?: string },
    userId: string,
  ) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        hebergementSelectionne: { select: { userId: true } },
        createur: { select: { email: true, prenom: true, nom: true } },
        demandes: { where: { statut: { not: 'ANNULEE' } }, select: { id: true }, take: 1 },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.hebergementSelectionne?.userId !== userId) {
      throw new ForbiddenException('Seul l\'hébergeur peut modifier les informations du séjour');
    }

    const updated = await this.prisma.sejour.update({
      where: { id: sejourId },
      data: {
        ...(dto.titre !== undefined && { titre: dto.titre }),
        ...(dto.dateDebut !== undefined && { dateDebut: new Date(dto.dateDebut) }),
        ...(dto.dateFin !== undefined && { dateFin: new Date(dto.dateFin) }),
      },
    });

    const demande = sejour.demandes?.[0];
    if (demande) {
      await this.prisma.demandeDevis.update({
        where: { id: demande.id },
        data: {
          ...(dto.titre !== undefined && { titre: dto.titre }),
          ...(dto.dateDebut !== undefined && { dateDebut: new Date(dto.dateDebut) }),
          ...(dto.dateFin !== undefined && { dateFin: new Date(dto.dateFin) }),
        },
      });
    }

    if (sejour.createur?.email) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
      const changes: string[] = [];
      if (dto.titre) changes.push(`Titre : <strong>${dto.titre}</strong>`);
      if (dto.dateDebut) changes.push(`Date de début : <strong>${new Date(dto.dateDebut).toLocaleDateString('fr-FR')}</strong>`);
      if (dto.dateFin) changes.push(`Date de fin : <strong>${new Date(dto.dateFin).toLocaleDateString('fr-FR')}</strong>`);

      this.email.sendGenericNotification(
        sejour.createur.email,
        `Informations de votre séjour mises à jour — ${updated.titre}`,
        `<p>Bonjour ${sejour.createur.prenom ?? ''},</p>
         <p>L'hébergeur a mis à jour les informations de votre séjour <strong>${updated.titre}</strong> :</p>
         <ul>${changes.map(c => `<li>${c}</li>`).join('')}</ul>
         <p style="margin:24px 0">
           <a href="${frontendUrl}/dashboard/sejour/${sejourId}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
             Voir mon séjour
           </a>
         </p>`,
      ).catch(() => {});
    }

    return updated;
  }
}
