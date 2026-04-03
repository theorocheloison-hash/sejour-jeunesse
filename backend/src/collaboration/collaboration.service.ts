import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { CreatePlanningDto } from './dto/create-planning.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

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
  ) {}

  /** Vérifie que le séjour est en CONVENTION et que l'utilisateur y a accès */
  async verifyAccess(sejourId: string, userId: string, role?: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        hebergementSelectionne: true,
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (!['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut)) {
      throw new ForbiddenException('Le séjour n\'est pas en statut CONVENTION');
    }

    const isCreateur = sejour.createurId === userId;
    const isVenue = sejour.hebergementSelectionne?.userId === userId;

    const isDirector = role === 'DIRECTOR';
    if (!isCreateur && !isVenue && !isDirector) {
      throw new ForbiddenException('Vous n\'avez pas accès à cet espace collaboratif');
    }

    return sejour;
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
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.message.create({
      data: {
        sejourId,
        auteurId: userId,
        contenu: dto.contenu,
      },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
      },
    });
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
    await this.verifyAccess(sejourId, userId, role);

    let url = dto.url ?? '';
    if (file) {
      url = await this.storage.upload(file, 'documents');
    }

    return this.prisma.documentSejour.create({
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
            prenom: true,
            nom: true,
            email: true,
            telephone: true,
            etablissementNom: true,
            etablissementAdresse: true,
            etablissementVille: true,
            etablissementUai: true,
            etablissementEmail: true,
            etablissementTelephone: true,
          },
        },
      },
    });

    const devis = demande?.devis?.[0] ?? null;

    const lignesCompl = await this.prisma.ligneBudgetComplementaire.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'asc' },
    });
    const recettes = await this.prisma.recetteBudget.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'asc' },
    });

    return { sejour, devis, lignesCompl, recettes };
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

  // ── Contraintes séjour ────────────────────────────────────────

  async getContraintesSejour(sejourId: string, userId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.contrainteSejour.findMany({
      where: { sejourId },
      include: { produit: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createContrainteSejour(sejourId: string, userId: string, dto: {
    libelle: string;
    type: string;
    date?: string;
    jourSemaine?: number;
    heureDebut?: string;
    heureFin?: string;
    produitId?: string;
  }, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    return this.prisma.contrainteSejour.create({
      data: {
        sejourId,
        libelle: dto.libelle,
        type: dto.type,
        date: dto.date ? new Date(dto.date) : null,
        jourSemaine: dto.jourSemaine ?? null,
        heureDebut: dto.heureDebut ?? null,
        heureFin: dto.heureFin ?? null,
        produitId: dto.produitId ?? null,
      },
      include: { produit: { select: { id: true, nom: true } } },
    });
  }

  async deleteContrainteSejour(sejourId: string, userId: string, contrainteId: string, role?: string) {
    await this.verifyAccess(sejourId, userId, role);
    const c = await this.prisma.contrainteSejour.findUnique({ where: { id: contrainteId } });
    if (!c || c.sejourId !== sejourId) throw new NotFoundException('Contrainte introuvable');
    return this.prisma.contrainteSejour.delete({ where: { id: contrainteId } });
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
        // Cap : taille optimale = min(LCM des capacités, moitié des élèves)
        const lcmCapacites = capacites.reduce((acc, c) => lcm(acc, c), capacites[0]);
        tailleOptimale = Math.min(lcmCapacites, Math.ceil(nombreEleves / 2));
      }
    }

    const nombreGroupes = Math.ceil(nombreEleves / tailleOptimale);
    const couleurs = ['#16a34a', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#374151'];

    const groupes = Array.from({ length: nombreGroupes }, (_, i) => {
      const isLast = i === nombreGroupes - 1;
      const taille = isLast ? nombreEleves - tailleOptimale * (nombreGroupes - 1) : tailleOptimale;
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

  async genererPlanningIA(sejourId: string, userId: string, role?: string): Promise<{ jobId: string }> {
    if (role !== 'VENUE') throw new ForbiddenException('Seul l\'hébergeur peut générer le planning');

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
      select: { id: true, nom: true, capaciteParGroupe: true, simultaneitePossible: true, dureeMinutes: true },
    });

    const groupes = await this.prisma.groupeSejour.findMany({
      where: { sejourId },
      select: { id: true, nom: true, couleur: true, taille: true },
    });

    const contraintesSejour = await this.prisma.contrainteSejour.findMany({
      where: { sejourId },
      include: { produit: { select: { nom: true } } },
    });

    const contraintesCentre = await this.prisma.contrainteCentre.findMany({
      where: { centreId, actif: true },
    });

    const nombreEleves = demande?.nombreEleves ?? sejour.placesTotales;
    const nombreAccompagnateurs = demande?.nombreAccompagnateurs ?? sejour.nombreAccompagnateurs ?? 1;
    const dateDebut = sejour.dateDebut.toISOString().split('T')[0];
    const dateFin = sejour.dateFin.toISOString().split('T')[0];

    const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    const contexte = {
      sejour: { dateDebut, dateFin, nombreEleves, nombreAccompagnateurs },
      groupes: groupes.length > 0 ? groupes : [{ nom: 'Groupe unique', taille: nombreEleves }],
      activites: activitesCatalogue
        .filter(a => devisSelectionne.lignes.some(l =>
          l.description.toLowerCase().includes(a.nom.toLowerCase()) ||
          a.nom.toLowerCase().includes(l.description.toLowerCase())
        ))
        .map(a => ({
          nom: a.nom,
          capaciteParGroupe: a.capaciteParGroupe ?? 'non défini',
          dureeMinutes: a.dureeMinutes ?? 120,
          simultaneitePossible: a.simultaneitePossible ?? true,
        })),
      contraintesSejour: contraintesSejour.map(c => ({
        libelle: c.libelle,
        type: c.type,
        date: c.date ? c.date.toISOString().split('T')[0] : null,
        jourSemaine: c.jourSemaine != null ? JOURS[c.jourSemaine] : null,
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
        activite: c.produit?.nom ?? null,
      })),
      contraintesCentre: contraintesCentre.map(c => ({
        libelle: c.libelle,
        type: c.type,
        jourSemaine: c.jourSemaine != null ? JOURS[c.jourSemaine] : null,
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
      })),
    };

    const jobId = `${sejourId}-${Date.now()}`;
    this.planningJobs.set(jobId, { status: 'pending' });

    this._appelAnthropicPlanning(jobId, sejourId, contexte).catch(() => {
      this.planningJobs.set(jobId, { status: 'error', error: 'Erreur lors de la génération' });
    });

    return { jobId };
  }

  private async _appelAnthropicPlanning(jobId: string, sejourId: string, contexte: any): Promise<void> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `Tu es un assistant spécialisé dans la création de plannings pour des séjours scolaires en France.
Tu dois générer un planning rotatif en JSON pur — aucun texte avant ou après, aucune balise markdown.

Règles strictes :
- Chaque groupe doit faire chaque activité exactement une fois sur le séjour
- Les activités démarrent au plus tôt à 09:00 et se terminent au plus tard à 18:00
- Respecte les contraintes de blocage (créneaux interdits)
- Pour les contraintes ACTIVITE_COLLECTIVE : tous les groupes font l'activité en même temps
- Pour les contraintes CONTRAINTE_ARRIVEE : pas d'activité avant l'heure indiquée le jour concerné
- Si simultaneitePossible est false pour une activité : un seul groupe à la fois peut la faire
- Si simultaneitePossible est true : plusieurs groupes peuvent la faire en parallèle
- Laisse une pause déjeuner de 12:00 à 14:00 chaque jour
- Attribue une couleur hex différente à chaque groupe (utilise la couleur fournie dans les groupes)

Format de réponse — tableau JSON uniquement :
[
  {
    "titre": "Nom de l'activité",
    "date": "YYYY-MM-DD",
    "heureDebut": "HH:MM",
    "heureFin": "HH:MM",
    "couleur": "#hexcode",
    "groupeNom": "Nom du groupe"
  }
]`;

    const userMessage = `Génère le planning pour ce séjour :\n${JSON.stringify(contexte, null, 2)}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    // Supprimer le planning existant avant d'insérer le nouveau
    await this.prisma.planningActivite.deleteMany({ where: { sejourId } });

    const rawText = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const clean = rawText.replace(/```json|```/g, '').trim();
    const planningItems: Array<{
      titre: string;
      date: string;
      heureDebut: string;
      heureFin: string;
      couleur: string;
      groupeNom: string;
    }> = JSON.parse(clean);

    const groupeMap = await this.prisma.groupeSejour.findMany({
      where: { sejourId },
      select: { id: true, nom: true, couleur: true },
    });

    const created = await Promise.all(
      planningItems.map(item => {
        const groupe = groupeMap.find(g => g.nom === item.groupeNom);
        return this.prisma.planningActivite.create({
          data: {
            sejourId,
            date: new Date(item.date),
            heureDebut: item.heureDebut,
            heureFin: item.heureFin,
            titre: item.titre,
            couleur: groupe?.couleur ?? item.couleur,
            groupeId: groupe?.id ?? null,
          },
        });
      })
    );

    this.planningJobs.set(jobId, { status: 'done', result: created });
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
}
