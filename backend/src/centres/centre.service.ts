import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { findOrCreateOrganisation, findOrCreateMembership } from '../organisations/organisation.helpers.js';
import { trialExpiration } from './trial.helper.js';

@Injectable()
export class CentreService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private storage: StorageService,
    private email: EmailService,
  ) {}

  async searchPublic(search: string) {
    if (!search || search.length < 2) return [];

    const EN_API =
      'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

    // ── Requête Prisma (sans filtre de statut) ────────────────────────
    const prismaPromise = this.prisma.centreHebergement.findMany({
      where: {
        OR: [
          { nom: { contains: search, mode: 'insensitive' } },
          { ville: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nom: true,
        adresse: true,
        ville: true,
        codePostal: true,
        telephone: true,
        email: true,
        capacite: true,
        description: true,
        departement: true,
        siret: true,
        agrementEducationNationale: true,
        typeSejours: true,
      },
      take: 10,
      orderBy: { nom: 'asc' },
    });

    // ── Requête API Éducation Nationale ───────────────────────────────
    const whereClause = [
      `search(nom_de_la_structure_d_accueil_et_d_hebergement_fr,"${search}")`,
      `search(nom_du_lieu_d_accueil_ville,"${search}")`,
    ].join(' OR ');

    const params = new URLSearchParams({ limit: '10', where: whereClause });

    const enPromise = fetch(`${EN_API}?${params}`)
      .then((res) => res.json())
      .then((data: { results: Array<Record<string, any>> }) =>
        (data.results ?? []).map((r) => ({
          id: r.identifiant as string,
          nom: r.nom_de_la_structure_d_accueil_et_d_hebergement_fr as string,
          adresse: '',
          ville: r.nom_du_lieu_d_accueil_ville as string,
          codePostal: r.nom_du_lieu_d_accueil_code_postal as string,
          telephone: null,
          email: null,
          capacite: (r.nombre_de_lits_pour_les_eleves as number) ?? 0,
          description: (r.description_longue as string) ?? null,
          departement: r.nom_du_lieu_d_accueil_departement as string,
          siret: null,
          agrementEducationNationale: null,
          typeSejours: [] as string[],
        })),
      )
      .catch(() => [] as Array<{
        id: string; nom: string; adresse: string; ville: string;
        codePostal: string; telephone: string | null; email: string | null;
        capacite: number; description: string | null; departement: string | null;
        siret: string | null; agrementEducationNationale: string | null;
        typeSejours: string[];
      }>);

    // ── Exécution parallèle — Prisma en premier, puis EN ─────────────
    const [prismaResults, enResults] = await Promise.all([prismaPromise, enPromise]);

    const normalise = (s: string): string =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    const prismaKeys = new Set(
      prismaResults.map((r) => `${normalise(r.nom)}|${normalise(r.ville)}`),
    );

    const prismaTagged = prismaResults.map((r) => ({ ...r, _source: 'BASE' as const }));
    const enDedup = enResults
      .filter((r) => !prismaKeys.has(`${normalise(r.nom)}|${normalise(r.ville)}`))
      .map((r) => ({ ...r, _source: 'API_EN' as const }));

    return [...prismaTagged, ...enDedup];
  }

  async getPublic(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return null;
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id },
      select: {
        id: true, nom: true, adresse: true, ville: true, codePostal: true,
        telephone: true, email: true, capacite: true, description: true,
        imageUrl: true, siteWeb: true, typeSejours: true, thematiquesCentre: true,
        activitesCentre: true, equipements: true, accessiblePmr: true,
        agrementEducationNationale: true, periodeOuverture: true, departement: true,
        source: true, apidaeId: true, organisationId: true,
      },
    });
    return centre ?? null;
  }

  async materialiserCentreEN(data: {
    identifiantEN: string;
    nom: string;
    ville: string;
    codePostal: string;
    capacite: number;
    departement: string | null;
  }): Promise<{ centreId: string; organisationId: string }> {
    // 1. Vérifier qu'un centre avec cet identifiant EN n'existe pas déjà
    const existant = await this.prisma.centreHebergement.findFirst({
      where: { apidaeId: data.identifiantEN, source: 'API_EN' },
      select: { id: true, organisationId: true },
    });
    if (existant) {
      if (existant.organisationId) {
        return { centreId: existant.id, organisationId: existant.organisationId };
      }
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom: data.nom,
        ville: data.ville,
        codePostal: data.codePostal,
        departement: data.departement ?? null,
        source: 'API_EDUCATION_NATIONALE',
        sourceId: data.identifiantEN,
      });
      await this.prisma.centreHebergement.update({
        where: { id: existant.id },
        data: { organisationId: organisation.id },
      });
      return { centreId: existant.id, organisationId: organisation.id };
    }

    // 2. Créer Organisation + CentreHebergement minimal
    const { organisation } = await findOrCreateOrganisation(this.prisma, {
      nom: data.nom,
      ville: data.ville,
      codePostal: data.codePostal,
      departement: data.departement ?? null,
      source: 'API_EDUCATION_NATIONALE',
      sourceId: data.identifiantEN,
    });

    const centre = await this.prisma.centreHebergement.create({
      data: {
        nom: data.nom,
        adresse: '',
        ville: data.ville,
        codePostal: data.codePostal,
        capacite: data.capacite,
        departement: data.departement ?? null,
        apidaeId: data.identifiantEN,
        source: 'API_EN',
        organisationId: organisation.id,
        statut: 'PENDING',
      },
    });

    return { centreId: centre.id, organisationId: organisation.id };
  }

  async register(dto: RegisterCentreDto) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token: dto.token },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.utilisedAt) throw new ConflictException('Cette invitation a déjà été utilisée');

    // CAS 1 (admin) — vérifier que le centre pré-existant est revendiquable AVANT de créer le User
    if (invitation.centreExistantId) {
      const centreCible = await this.prisma.centreHebergement.findUnique({
        where: { id: invitation.centreExistantId },
      });
      if (!centreCible) {
        throw new NotFoundException('Le centre lié à cette invitation est introuvable');
      }
      if (centreCible.userId) {
        throw new ConflictException('Ce centre a déjà un propriétaire');
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.prenom ?? dto.nom ?? '',
        nom: dto.nomContact ?? '',
        email: invitation.email,
        motDePasse: hashed,
        role: Role.HEBERGEUR,
      },
    });

    let centre: Awaited<ReturnType<typeof this.prisma.centreHebergement.findUnique>>;
    let centreExistantApidae:
      | Awaited<ReturnType<typeof this.prisma.centreHebergement.findFirst>>
      | null = null;

    if (invitation.centreExistantId) {
      // ── CAS 1 : invitation admin pointant vers un centre déjà en base ────
      centre = await this.prisma.centreHebergement.update({
        where: { id: invitation.centreExistantId },
        data: { userId: user.id, statut: 'ACTIVE' },
      });
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    } else if (invitation.centrePrecreerNom) {
      // ── CAS 2 : invitation admin avec données pré-remplies ─────────────
      centre = await this.prisma.centreHebergement.create({
        data: {
          nom:         invitation.centrePrecreerNom,
          adresse:     invitation.centrePrecreerAdresse ?? '',
          ville:       invitation.centrePrecreerVille ?? '',
          codePostal:  invitation.centrePrecreerCodePostal ?? '',
          capacite:    invitation.centrePrecreerCapacite ?? 0,
          siret:       invitation.centrePrecreerSiret ?? null,
          departement: invitation.centrePrecreerDepartement ?? null,
          email:       invitation.email,
          userId:      user.id,
          statut:      'ACTIVE',
        },
      });
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    } else {
      // ── CAS 3 : invitation minimale (réseau ou autonome) — matching APIDAE ─
      // Passe 1 : par email
      centreExistantApidae = await this.prisma.centreHebergement.findFirst({
        where: {
          email: invitation.email,
          userId: null,
          source: 'APIDAE',
        },
      });

      // Passe 2 : fallback nom + ville si pas trouvé
      if (!centreExistantApidae && dto.nom && dto.ville) {
        centreExistantApidae = await this.prisma.centreHebergement.findFirst({
          where: {
            userId: null,
            source: 'APIDAE',
            nom: { equals: dto.nom, mode: 'insensitive' },
            ville: { equals: dto.ville, mode: 'insensitive' },
          },
        });
      }

      if (centreExistantApidae) {
        // Claim du centre APIDAE — merge non-écrasant
        centre = await this.prisma.centreHebergement.update({
          where: { id: centreExistantApidae.id },
          data: {
            userId: user.id,
            statut: 'ACTIVE',
            ...(dto.nom && !centreExistantApidae.nom && { nom: dto.nom }),
            ...(dto.adresse && !centreExistantApidae.adresse && { adresse: dto.adresse }),
            ...(dto.ville && !centreExistantApidae.ville && { ville: dto.ville }),
            ...(dto.codePostal && !centreExistantApidae.codePostal && { codePostal: dto.codePostal }),
            ...(dto.telephone && !centreExistantApidae.telephone && { telephone: dto.telephone }),
          },
        });
      } else {
        centre = await this.prisma.centreHebergement.create({
          data: {
            nom: dto.nom ?? '',
            adresse: dto.adresse ?? '',
            ville: dto.ville ?? '',
            codePostal: dto.codePostal ?? '',
            telephone: dto.telephone ?? null,
            email: invitation.email,
            capacite: dto.capacite ?? 0,
            description: dto.description ?? null,
            reseau: dto.reseau ?? null,
            userId: user.id,
            statut: 'ACTIVE',
          },
        });
      }
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: {
          planAbonnement: 'COMPLET',
          abonnementStatut: 'ACTIF',
          abonnementActifJusquAu: trialExpiration(),
        },
      });
    }

    if (!centre) {
      throw new NotFoundException('Centre introuvable après création');
    }

    await this.prisma.invitationHebergement.update({
      where: { id: invitation.id },
      data: { utilisedAt: new Date() },
    });

    // Organisation + Membership (commun aux 3 cas)
    let organisationId = centre.organisationId;
    if (!organisationId) {
      const { organisation } = await findOrCreateOrganisation(this.prisma, {
        nom: centre.nom,
        adresse: centre.adresse,
        codePostal: centre.codePostal,
        ville: centre.ville,
        emailContact: centre.email,
        telephoneContact: centre.telephone,
        siteWeb: centre.siteWeb,
        siret: centre.siret,
        siren: centre.siret ? centre.siret.substring(0, 9) : null,
        source: centreExistantApidae ? 'APIDAE' : 'MANUAL',
        sourceId: centreExistantApidae?.apidaeId ?? null,
        typeStructure: null,
      });
      organisationId = organisation.id;
      await this.prisma.centreHebergement.update({
        where: { id: centre.id },
        data: { organisationId },
      });
    }

    await findOrCreateMembership(this.prisma, {
      userId: user.id,
      organisationId,
      role: 'PROPRIETAIRE',
      isPrimary: true,
      claimStatut: 'NON_APPLICABLE',
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role },
      centre,
    };
  }

  async checkInvitation(token: string): Promise<{
    cas: 1 | 2 | 3;
    isApidae: boolean;
    centreExistantId: string | null;
    centre: {
      id?: string;
      nom: string;
      ville: string;
      departement: string | null;
      capacite: number;
      imageUrl: string | null;
    } | null;
    precreer: {
      nom: string;
      adresse: string | null;
      ville: string | null;
      codePostal: string | null;
      capacite: number | null;
      siret: string | null;
      departement: string | null;
    } | null;
  }> {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token },
      include: {
        centreExistant: {
          select: {
            id: true, nom: true, ville: true, departement: true,
            capacite: true, imageUrl: true,
          },
        },
      },
    });

    if (!invitation || invitation.utilisedAt) {
      return { cas: 3, isApidae: false, centre: null, centreExistantId: null, precreer: null };
    }

    // CAS 1 : centre existant pointé par l'admin
    if (invitation.centreExistantId && invitation.centreExistant) {
      return {
        cas: 1,
        isApidae: false,
        centre: invitation.centreExistant,
        centreExistantId: invitation.centreExistantId,
        precreer: null,
      };
    }

    // CAS 2 : données pré-remplies par l'admin
    if (invitation.centrePrecreerNom) {
      return {
        cas: 2,
        isApidae: false,
        centre: {
          nom: invitation.centrePrecreerNom,
          ville: invitation.centrePrecreerVille ?? '',
          departement: invitation.centrePrecreerDepartement ?? null,
          capacite: invitation.centrePrecreerCapacite ?? 0,
          imageUrl: null,
        },
        centreExistantId: null,
        precreer: {
          nom: invitation.centrePrecreerNom,
          adresse: invitation.centrePrecreerAdresse ?? null,
          ville: invitation.centrePrecreerVille ?? null,
          codePostal: invitation.centrePrecreerCodePostal ?? null,
          capacite: invitation.centrePrecreerCapacite ?? null,
          siret: invitation.centrePrecreerSiret ?? null,
          departement: invitation.centrePrecreerDepartement ?? null,
        },
      };
    }

    // CAS 3 : matching APIDAE existant — passe 1 email, passe 2 nomCentre
    let centre = await this.prisma.centreHebergement.findFirst({
      where: { email: invitation.email, userId: null, source: 'APIDAE' },
      select: { nom: true, ville: true, departement: true, capacite: true, imageUrl: true },
    });
    if (!centre && invitation.nomCentre) {
      centre = await this.prisma.centreHebergement.findFirst({
        where: {
          userId: null,
          source: 'APIDAE',
          nom: { equals: invitation.nomCentre, mode: 'insensitive' },
        },
        select: { nom: true, ville: true, departement: true, capacite: true, imageUrl: true },
      });
    }
    return {
      cas: 3,
      isApidae: !!centre,
      centre: centre ?? null,
      centreExistantId: null,
      precreer: null,
    };
  }

  async getMonProfil(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    return centre;
  }

  async updateMonProfil(userId: string, dto: UpdateCentreDto) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        ...dto,
        ...(dto.equipements !== undefined && { equipements: { set: dto.equipements } }),
        ...(dto.thematiquesCentre !== undefined && { thematiquesCentre: { set: dto.thematiquesCentre } }),
        ...(dto.activitesCentre !== undefined && { activitesCentre: { set: dto.activitesCentre } }),
      },
    });
  }

  async uploadImage(userId: string, file: Express.Multer.File) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new ForbiddenException('Format non supporté. Utilisez JPG, PNG ou WebP.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ForbiddenException('Fichier trop lourd. Maximum 10MB.');
    }

    if (centre.imageUrl) {
      await this.storage.delete(centre.imageUrl);
    }

    const imageUrl = await this.storage.upload(file, 'centres');

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { imageUrl },
    });
  }

  async uploadBrochure(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Fichier trop lourd (max 10 Mo)');
    }

    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const brochureUrl = await this.storage.upload(file, `centres/${centre.id}/brochures`);

    await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: { brochureUrl },
    });

    return { brochureUrl };
  }

  async uploadDocument(userId: string, file: Express.Multer.File, dto: CreateDocumentDto) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const url = await this.storage.upload(file, 'documents-centre');

    return this.prisma.document.create({
      data: {
        centreId: centre.id,
        type: dto.type,
        nom: dto.nom,
        url,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
      },
    });
  }

  async getDisponibilites(userId: string) {
    const centre = await this.getMonProfil(userId);
    return this.prisma.disponibilite.findMany({
      where: { centreId: centre.id },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async createDisponibilite(userId: string, dto: CreateDisponibiliteDto) {
    const centre = await this.getMonProfil(userId);
    return this.prisma.disponibilite.create({
      data: {
        centreId: centre.id,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        capaciteDisponible: dto.capaciteDisponible,
        commentaire: dto.commentaire,
      },
    });
  }

  async deleteDisponibilite(userId: string, id: string) {
    const centre = await this.getMonProfil(userId);
    const dispo = await this.prisma.disponibilite.findUnique({ where: { id } });
    if (!dispo || dispo.centreId !== centre.id) {
      throw new ForbiddenException('Disponibilité introuvable ou non autorisée');
    }
    return this.prisma.disponibilite.delete({ where: { id } });
  }

  async getDocuments(userId: string) {
    const centre = await this.getMonProfil(userId);
    return this.prisma.document.findMany({
      where: { centreId: centre.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(userId: string, dto: CreateDocumentDto) {
    const centre = await this.getMonProfil(userId);
    return this.prisma.document.create({
      data: {
        centreId: centre.id,
        type: dto.type,
        nom: dto.nom,
        dateExpiration: dto.dateExpiration ? new Date(dto.dateExpiration) : null,
      },
    });
  }

  async getProduitsCatalogue(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const existants = await this.prisma.produitCatalogue.findMany({
      where: { centreId: centre.id },
    });

    if (existants.length === 0) {
      await this.prisma.produitCatalogue.createMany({
        data: [
          {
            centreId: centre.id,
            nom: 'Pension complète',
            description: 'Repas du soir, nuitée, petit-déjeuner, repas du midi (panier repas ou sur place) et goûter',
            type: 'HEBERGEMENT',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Location matériel ski',
            description: null,
            type: 'ACTIVITE',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Cours ESF',
            description: null,
            type: 'ACTIVITE',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
          {
            centreId: centre.id,
            nom: 'Transport aller-retour',
            description: null,
            type: 'TRANSPORT',
            prixUnitaireHT: 0,
            tva: 10,
            unite: 'PAR_ELEVE',
            actif: true,
          },
        ],
      });

      return this.prisma.produitCatalogue.findMany({
        where: { centreId: centre.id, actif: true },
        orderBy: [{ type: 'asc' }, { nom: 'asc' }],
      });
    }

    return this.prisma.produitCatalogue.findMany({
      where: { centreId: centre.id, actif: true },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    });
  }

  async createProduit(userId: string, dto: {
    nom: string;
    description?: string;
    type: string;
    prixUnitaireHT: number;
    prixUnitaireTTC?: number;
    tva: number;
    unite: string;
    nbMoniteursMax?: number;
  }) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    return this.prisma.produitCatalogue.create({
      data: { centreId: centre.id, ...dto },
    });
  }

  async importProduits(userId: string, produits: {
    nom: string;
    description?: string;
    type: string;
    prixUnitaireHT: number;
    prixUnitaireTTC?: number;
    tva: number;
    unite: string;
  }[]) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const valides = produits.filter(p =>
      p.nom &&
      ['HEBERGEMENT', 'REPAS', 'TRANSPORT', 'ACTIVITE', 'AUTRE'].includes(p.type) &&
      ['PAR_ELEVE', 'PAR_NUIT', 'PAR_JOUR', 'FORFAIT'].includes(p.unite) &&
      !isNaN(p.prixUnitaireHT) &&
      p.prixUnitaireHT >= 0 &&
      [0, 5.5, 10, 20].includes(p.tva)
    );

    if (valides.length === 0) throw new BadRequestException('Aucun produit valide trouvé dans le fichier');

    await this.prisma.produitCatalogue.createMany({
      data: valides.map(p => ({
        centreId: centre.id,
        nom: p.nom,
        description: p.description ?? null,
        type: p.type,
        prixUnitaireHT: p.prixUnitaireHT,
        prixUnitaireTTC: p.prixUnitaireTTC ?? null,
        tva: p.tva,
        unite: p.unite,
        actif: true,
      })),
    });

    return { imported: valides.length, total: produits.length };
  }

  async updateProduit(userId: string, produitId: string, dto: {
    nom?: string;
    description?: string;
    type?: string;
    prixUnitaireHT?: number;
    prixUnitaireTTC?: number;
    tva?: number;
    unite?: string;
  }) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: dto,
    });
  }

  async accepterMandatFacturation(userId: string, ipAddress: string | null = null, userAgent: string | null = null) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.mandatFacturationAccepte) {
      return centre; // Déjà accepté — ne pas écraser ip/ua
    }

    const version = process.env.MANDAT_VERSION ?? '1.0';
    const dateAcceptation = new Date();

    const updated = await this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mandatFacturationAccepte: true,
        mandatFacturationAccepteAt: dateAcceptation,
        mandatFacturationVersion: version,
        mandatFacturationIpAddress: ipAddress,
        mandatFacturationUserAgent: userAgent,
      },
    });

    // Email de confirmation (non bloquant)
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user) {
        await this.email.sendMandatFacturationConfirmation(
          user.email,
          centre.nom,
          dateAcceptation,
          version,
        );
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  async archiveProduit(userId: string, produitId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: { actif: false },
    });
  }

  async updateCapacitesProduit(userId: string, produitId: string, dto: {
    capaciteParGroupe?: number | null;
    encadrementParGroupe?: number | null;
    simultaneitePossible?: boolean;
    dureeMinutes?: number | null;
    nbMoniteursMax?: number | null;
  }) {
    const centre = await this.prisma.centreHebergement.findFirst({ where: { userId } });
    if (!centre) throw new NotFoundException('Centre introuvable');
    const produit = await this.prisma.produitCatalogue.findUnique({ where: { id: produitId } });
    if (!produit || produit.centreId !== centre.id) throw new ForbiddenException('Produit introuvable');
    return this.prisma.produitCatalogue.update({
      where: { id: produitId },
      data: dto,
    });
  }

}
