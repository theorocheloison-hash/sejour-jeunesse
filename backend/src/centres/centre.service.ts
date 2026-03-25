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
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Injectable()
export class CentreService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private storage: StorageService,
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

    return [...prismaResults, ...enResults];
  }

  async register(dto: RegisterCentreDto) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token: dto.token },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.utilisedAt) throw new ConflictException('Cette invitation a déjà été utilisée');

    const existing = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        prenom: dto.nom,
        nom: '',
        email: invitation.email,
        motDePasse: hashed,
        role: Role.VENUE,
      },
    });

    const centre = await this.prisma.centreHebergement.create({
      data: {
        nom: dto.nom,
        adresse: dto.adresse,
        ville: dto.ville,
        codePostal: dto.codePostal,
        telephone: dto.telephone,
        email: invitation.email,
        capacite: dto.capacite,
        description: dto.description,
        userId: user.id,
      },
    });

    await this.prisma.invitationHebergement.update({
      where: { id: invitation.id },
      data: { utilisedAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, role: user.role },
      centre,
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
      data: dto,
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

  async accepterMandatFacturation(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.mandatFacturationAccepte) {
      return centre; // Déjà accepté — idempotent
    }
    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        mandatFacturationAccepte: true,
        mandatFacturationAccepteAt: new Date(),
        mandatFacturationVersion: process.env.MANDAT_VERSION ?? '1.0',
      },
    });
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
}
