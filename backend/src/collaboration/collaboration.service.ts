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
      select: { id: true, nom: true, couleur: true, taille: true, createdAt: true },
    });

    const activitesManuelles = await this.prisma.planningActivite.findMany({
      where: { sejourId, estManuelle: true },
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    });

    const nombreEleves = demande?.nombreEleves ?? sejour.placesTotales;
    const nombreAccompagnateurs = demande?.nombreAccompagnateurs ?? sejour.nombreAccompagnateurs ?? 1;
    const dateDebut = sejour.dateDebut.toISOString().split('T')[0];
    const dateFin = sejour.dateFin.toISOString().split('T')[0];

    // Calculer les paires stables de groupes (G1+G2, G3+G4, G5+G6, etc.)
    // Les groupes sont triés par ordre de création (createdAt asc)
    const groupesTries = [...groupes].sort((a, b) =>
      (a as any).createdAt < (b as any).createdAt ? -1 : 1
    );
    const pairesGroupes: { groupe1: string; groupe2: string | null }[] = [];
    for (let i = 0; i < groupesTries.length; i += 2) {
      pairesGroupes.push({
        groupe1: groupesTries[i].nom,
        groupe2: groupesTries[i + 1]?.nom ?? null,
      });
    }

    const contexte = {
      sejour: { dateDebut, dateFin, nombreEleves, nombreAccompagnateurs },
      plageActivites: {
        debut: debutActivites ?? `${dateDebut}T09:00`,
        fin: finActivites ?? `${dateFin}T18:00`,
      },
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
      pairesGroupes,
      activitesManuelles: activitesManuelles.map(a => ({
        titre: a.titre,
        date: a.date.toISOString().split('T')[0],
        heureDebut: a.heureDebut,
        heureFin: a.heureFin,
        estCollective: a.estCollective,
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

    const systemPrompt = `Tu es un assistant expert en planification de séjours scolaires en montagne.
Tu génères un planning rotatif en JSON pur — aucun texte avant ou après, aucune balise markdown.

RÈGLES ABSOLUES :

1. ACTIVITÉS MANUELLES — PRIORITÉ MAXIMALE
   - Le contexte contient une liste "activitesManuelles" : ce sont des activités déjà placées par l'hébergeur, à ne JAMAIS déplacer ni modifier
   - Les activités manuelles avec estCollective=true sont faites par TOUS les groupes simultanément — ne pas les router en rotation
   - Respecte ces créneaux comme des contraintes fixes

2. GROUPES ET COULEURS
   - Chaque entrée du planning correspond à UN groupe précis faisant UNE activité
   - Le champ "groupeNom" doit être EXACTEMENT le nom du groupe tel que fourni
   - Le champ "couleur" doit être EXACTEMENT la couleur hex fournie pour ce groupe
   - Le champ "titre" doit contenir : "NOM_ACTIVITE — NOM_GROUPE"

3. PAIRES STABLES ET ROTATION
   - Le contexte contient "pairesGroupes" : ce sont les paires fixes de groupes pour tout le séjour
   - Exemple : paire [G1, G2] signifie que G1 et G2 font toujours la même activité en même temps
   - RÈGLE ABSOLUE : si G1 fait Rafting à 9h lundi, G2 fait aussi Rafting à 9h lundi — même activité, même créneau exact, même date
   - Cette règle s'applique sur TOUS les créneaux du séjour sans exception
   - Un groupe seul (groupe2: null) est traité individuellement
   - Chaque paire fait chaque activité exactement une fois sur le séjour
   - Si simultaneitePossible est true : plusieurs paires peuvent faire la même activité en parallèle
   - Si simultaneitePossible est false : une seule paire à la fois sur cette activité

4. HORAIRES
   - Activités entre 09:00 et 18:00 uniquement
   - Pause déjeuner obligatoire 12:00-14:00
   - Respecte les durées indiquées dans dureeMinutes
   - Ne génère AUCUNE activité sur les créneaux des activitesManuelles

Format de réponse — tableau JSON uniquement :
[
  {
    "titre": "NOM_ACTIVITE — NOM_GROUPE",
    "date": "YYYY-MM-DD",
    "heureDebut": "HH:MM",
    "heureFin": "HH:MM",
    "couleur": "#hexcode_exact_du_groupe",
    "groupeNom": "nom_exact_du_groupe"
  }
]`;

    const userMessage = `Génère le planning pour ce séjour :\n${JSON.stringify(contexte, null, 2)}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    // Supprimer le planning existant avant d'insérer le nouveau
    await this.prisma.planningActivite.deleteMany({ where: { sejourId, estManuelle: false } });

    if (response.stop_reason === 'max_tokens') {
      console.error('[PlanningIA] Réponse tronquée — max_tokens atteint. Augmenter max_tokens ou réduire le contexte.');
    }

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
        const groupe = groupeMap.find(g =>
          g.nom.trim().toLowerCase() === item.groupeNom?.trim().toLowerCase()
        );
        return this.prisma.planningActivite.create({
          data: {
            sejourId,
            date: new Date(item.date),
            heureDebut: item.heureDebut,
            heureFin: item.heureFin,
            titre: item.titre,
            couleur: groupe?.couleur ?? item.couleur,
            groupeId: groupe?.id ?? null,
            estManuelle: false,
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
