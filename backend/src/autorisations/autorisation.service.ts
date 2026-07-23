import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma } from '@prisma/client';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';
import { computeTokenExpiresAt, assertTokenNotExpired } from '../common/token-expiration.js';

const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

// Participant en mode saisie directe (création batch + mise à jour inline)
export interface ParticipantDirectInput {
  eleveNom?: string;
  elevePrenom?: string;
  parentEmail?: string | null;
  taille?: number | null;
  poids?: number | null;
  pointure?: number | null;
  niveauSki?: string | null;
  regimeAlimentaire?: string | null;
  eleveDateNaissance?: string | null;
  nomParent?: string | null;
  telephoneUrgence?: string | null;
  infosMedicales?: string | null;
  champsPersonnalises?: Record<string, unknown> | null;
  // SC7 : donnée d'organisation interne (jamais côté parent), null = non catégorisé
  hebergementCategorie?: 'FILLE' | 'GARCON' | 'AUTRE' | null;
}

// Parse une date ISO ; retourne null si absente ou invalide (jamais d'Invalid Date)
function parseDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// SC7 — mappe PRUDEMMENT une valeur CSV de sexe/genre vers la catégorie
// d'hébergement. Matching sur la valeur normalisée COMPLÈTE (jamais includes,
// pour éviter que « Féminin » matche « M ») ; toute autre valeur — y compris
// les codes numériques « 1 »/« 2 » (l'ordre ONDE n'est pas fiable) → null,
// l'organisateur catégorise à la main.
function mapSexeToCategorie(val: string): 'FILLE' | 'GARCON' | null {
  const normalise = val
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['F', 'FILLE', 'FEMININ', 'FEMME'].includes(normalise)) return 'FILLE';
  if (['M', 'G', 'GARCON', 'MASCULIN', 'HOMME'].includes(normalise)) return 'GARCON';
  return null;
}

// Parse une date CSV en gérant le format français JJ/MM/AAAA (sinon ISO en fallback)
function parseDateFR(val: string): Date | null {
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class AutorisationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private storage: StorageService,
  ) {}

  async create(dto: CreateAutorisationDto, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const autorisation = await this.prisma.autorisationParentale.create({
      data: {
        sejourId: dto.sejourId,
        eleveNom: dto.eleveNom,
        elevePrenom: dto.elevePrenom,
        parentEmail: dto.parentEmail,
        hebergementCategorie: dto.hebergementCategorie ?? null,
        tokenExpiresAt: computeTokenExpiresAt(sejour.dateFin),
      },
    });

    // Envoyer l'email d'autorisation parentale
    const lien = `${FRONTEND_URL}/autorisation/${autorisation.tokenAcces}`;
    await this.email.sendAutorisationParentale(
      dto.parentEmail,
      `${dto.elevePrenom} ${dto.eleveNom}`,
      sejour.titre,
      lien,
    );

    await this.prisma.autorisationParentale.update({
      where: { id: autorisation.id },
      data: { emailEnvoye: true },
    });

    return autorisation;
  }

  async createSansEmail(dto: CreateAutorisationDto, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: dto.sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.create({
      data: {
        sejourId: dto.sejourId,
        eleveNom: dto.eleveNom,
        elevePrenom: dto.elevePrenom,
        parentEmail: dto.parentEmail,
        hebergementCategorie: dto.hebergementCategorie ?? null,
        tokenExpiresAt: computeTokenExpiresAt(sejour.dateFin),
      },
    });
  }

  async envoyerInvitations(sejourId: string, createurId: string, autorisationIds?: string[]) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const where: {
      sejourId: string;
      signeeAt: null;
      parentEmail: { not: null };
      id?: { in: string[] };
    } = { sejourId, signeeAt: null, parentEmail: { not: null } };
    if (autorisationIds && autorisationIds.length > 0) {
      where.id = { in: autorisationIds };
    }

    const autorisations = await this.prisma.autorisationParentale.findMany({ where });

    let sent = 0;
    const errors: string[] = [];

    for (const auth of autorisations) {
      try {
        const lien = `${FRONTEND_URL}/autorisation/${auth.tokenAcces}`;
        await this.email.sendAutorisationParentale(
          auth.parentEmail!, // garanti non-null par le filtre where parentEmail: { not: null }
          `${auth.elevePrenom} ${auth.eleveNom}`,
          sejour.titre,
          lien,
        );
        await this.prisma.autorisationParentale.update({
          where: { id: auth.id },
          data: { emailEnvoye: true },
        });
        sent++;
      } catch {
        errors.push(`Erreur envoi pour ${auth.elevePrenom} ${auth.eleveNom} (${auth.parentEmail})`);
      }
    }

    return { sent, total: autorisations.length, errors };
  }

  async getByToken(token: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
      include: {
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            description: true,
            niveauClasse: true,
            thematiquesPedagogiques: true,
            placesTotales: true,
            prix: true,
            hebergements: {
              select: {
                nom: true,
                adresse: true,
                ville: true,
                type: true,
                capacite: true,
              },
              take: 1,
            },
            demandes: {
              select: {
                devis: {
                  where: { statut: 'SELECTIONNE' },
                  select: { montantParEleve: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    assertTokenNotExpired(autorisation.tokenExpiresAt, 'Autorisation');

    const sejour = autorisation.sejour;
    const hebergement = sejour.hebergements[0] ?? null;

    // Find montantParEleve from selected devis
    const devisSelectionne = sejour.demandes
      ?.flatMap((d) => d.devis)
      .find((dv) => dv);
    const montantParEleve = devisSelectionne?.montantParEleve
      ?? (Number(sejour.prix) > 0 ? String(sejour.prix) : null);

    return {
      eleveNom: autorisation.eleveNom,
      elevePrenom: autorisation.elevePrenom,
      signeeAt: autorisation.signeeAt,
      attestationAssuranceUrl: autorisation.attestationAssuranceUrl,
      sejour: {
        titre: sejour.titre,
        lieu: sejour.lieu,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        description: sejour.description,
        niveauClasse: sejour.niveauClasse,
        thematiquesPedagogiques: sejour.thematiquesPedagogiques,
        placesTotales: sejour.placesTotales,
        montantParEleve,
      },
      hebergement,
    };
  }

  async signer(token: string, dto: SignerAutorisationDto, ipAddress?: string) {
    if (!dto.rgpdAccepte) {
      throw new BadRequestException(
        'Vous devez accepter les conditions de traitement des données personnelles (RGPD).',
      );
    }

    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    assertTokenNotExpired(autorisation.tokenExpiresAt, 'Autorisation');
    if (autorisation.signeeAt)
      throw new ConflictException('Cette autorisation a déjà été signée');

    return this.prisma.autorisationParentale.update({
      where: { tokenAcces: token },
      data: {
        signeeAt: new Date(),
        signatureIpAddress: ipAddress ?? null,
        signatureHash: createHash('sha256')
          .update(`${autorisation.id}${token}${new Date().toISOString()}`)
          .digest('hex'),
        taille: dto.taille ?? null,
        poids: dto.poids ?? null,
        pointure: dto.pointure ?? null,
        regimeAlimentaire: dto.regimeAlimentaire ?? null,
        niveauSki: dto.niveauSki ?? null,
        infosMedicales: dto.infosMedicales ?? null,
        nomParent: dto.nomParent ?? null,
        telephoneUrgence: dto.telephoneUrgence ?? null,
        eleveDateNaissance: dto.eleveDateNaissance ? new Date(dto.eleveDateNaissance) : null,
        rgpdAccepte: true,
        rgpdAccepteAt: new Date(),
        rgpdVersionCgu: process.env.CGU_VERSION ?? '1.0',
        consentementMedical: dto.consentementMedical ?? false,
        consentementMedicalAt: dto.consentementMedical ? new Date() : null,
        nombreMensualites: dto.nombreMensualites ?? 1,
        moyenPaiement: dto.moyenPaiement ?? null,
      },
    });
  }

  async uploadDocumentMedical(token: string, file: Express.Multer.File, type?: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    assertTokenNotExpired(autorisation.tokenExpiresAt, 'Autorisation');

    const isAssurance = type === 'assurance';
    const folder = isAssurance ? 'attestations-assurance' : 'documents-medicaux';
    const url = await this.storage.upload(file, folder);

    return this.prisma.autorisationParentale.update({
      where: { tokenAcces: token },
      data: isAssurance ? { attestationAssuranceUrl: url } : { documentMedicalUrl: url },
    });
  }

  async validerPaiement(autorisationId: string, userId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id: autorisationId },
      include: { sejour: { select: { createurId: true } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette autorisation');
    }

    return this.prisma.autorisationParentale.update({
      where: { id: autorisationId },
      data: {
        paiementValide: true,
        datePaiement: new Date(),
      },
    });
  }

  async validerPaiementPartiel(autorisationId: string, montant: number, userId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id: autorisationId },
      include: { sejour: { select: { createurId: true } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== userId) {
      throw new ForbiddenException('Accès non autorisé à cette autorisation');
    }
    if (autorisation.paiementValide) {
      throw new ConflictException('Le paiement est déjà totalement validé');
    }

    const nouveauMontantVerse = (autorisation.montantVerseTotal ?? 0) + montant;
    const nouveauNombreVersements = (autorisation.nombreVersementsEffectues ?? 0) + 1;

    return this.prisma.autorisationParentale.update({
      where: { id: autorisationId },
      data: {
        montantVerseTotal: nouveauMontantVerse,
        nombreVersementsEffectues: nouveauNombreVersements,
      },
    });
  }

  async importCsv(file: Express.Multer.File, sejourId: string, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId) throw new ForbiddenException('Ce séjour ne vous appartient pas');

    let content = file.buffer.toString('utf-8');
    if (/Ã[©¨ª«]|Ã|Ã©/.test(content)) {
      content = Array.from(file.buffer).map((b) => String.fromCharCode(b)).join('');
    }
    const lines = content.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) throw new BadRequestException('Le fichier doit contenir au moins un en-tête et une ligne de données');
    if (lines.length > 201) throw new BadRequestException('Le fichier ne peut pas contenir plus de 200 élèves');

    const header = lines[0];
    const sep = [';', ',', '\t'].reduce((best, s) =>
      header.split(s).length > header.split(best).length ? s : best, ';');

    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const findCol = (keywords: string[]): number =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    const colNom = findCol(['nom']);
    const colPrenom = findCol(['prénom', 'prenom']);
    const colEmail = findCol(['email', 'mail', 'courriel', 'e-mail']);
    const colTaille = findCol(['taille', 'taille (cm)', 'taille cm']);
    const colPoids = findCol(['poids', 'poids (kg)', 'poids kg']);
    const colPointure = findCol(['pointure', 'pointure ski', 'taille chaussure']);
    const colNiveauSki = findCol(['ski', 'niveau ski', 'niveau de ski']);
    const colRegime = findCol(['régime', 'regime', 'régime alimentaire', 'regime alimentaire', 'allergie', 'allergies']);
    const colDateNaissance = findCol(['naissance', 'date de naissance', 'date naissance', 'né(e) le', 'née le']);
    const colNomParent = findCol(['parent', 'nom parent', 'nom du parent', 'responsable', 'nom responsable']);
    const colTelUrgence = findCol(['urgence', 'tel urgence', 'téléphone urgence', 'telephone urgence', 'tel. urgence']);
    const colInfosMedicales = findCol(['médical', 'medical', 'infos médicales', 'infos medicales', 'santé', 'sante']);
    const colSexe = findCol(['sexe', 'genre', 'fille', 'garçon', 'garcon']);

    if (colNom === -1) throw new BadRequestException('Colonne "Nom" introuvable. Colonnes détectées : ' + headers.join(', '));
    if (colPrenom === -1) throw new BadRequestException('Colonne "Prénom" introuvable. Colonnes détectées : ' + headers.join(', '));
    // colEmail optionnel : si absent, les participants sont créés sans email (saisie directe)

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const existingAuths = await this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      select: { eleveNom: true, elevePrenom: true },
    });
    const existingSet = new Set(existingAuths.map((a) => `${a.eleveNom.toLowerCase()}|${a.elevePrenom.toLowerCase()}`));

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim().replace(/"/g, ''));
      const nom = cols[colNom]?.trim();
      const prenom = cols[colPrenom]?.trim();
      const email = colEmail !== -1 ? cols[colEmail]?.trim() : undefined;

      if (!nom || !prenom) {
        results.skipped++;
        continue;
      }

      const key = `${nom.toLowerCase()}|${prenom.toLowerCase()}`;
      if (existingSet.has(key)) {
        results.skipped++;
        continue;
      }

      // Email non-bloquant : conservé seulement s'il est valide, sinon null
      const parentEmail = email && email.includes('@') ? email : null;

      const data: Prisma.AutorisationParentaleUncheckedCreateInput = {
        sejourId,
        eleveNom: nom.toUpperCase(),
        elevePrenom: prenom,
        parentEmail,
        sourceInscription: 'CSV',
        tokenExpiresAt: computeTokenExpiresAt(sejour.dateFin),
      };
      if (colTaille !== -1 && cols[colTaille]?.trim()) {
        const v = parseInt(cols[colTaille].trim(), 10);
        if (!isNaN(v)) data.taille = v;
      }
      if (colPoids !== -1 && cols[colPoids]?.trim()) {
        const v = parseInt(cols[colPoids].trim(), 10);
        if (!isNaN(v)) data.poids = v;
      }
      if (colPointure !== -1 && cols[colPointure]?.trim()) {
        const v = parseInt(cols[colPointure].trim(), 10);
        if (!isNaN(v)) data.pointure = v;
      }
      if (colNiveauSki !== -1 && cols[colNiveauSki]?.trim()) data.niveauSki = cols[colNiveauSki].trim();
      if (colRegime !== -1 && cols[colRegime]?.trim()) data.regimeAlimentaire = cols[colRegime].trim();
      if (colDateNaissance !== -1 && cols[colDateNaissance]?.trim()) {
        const d = parseDateFR(cols[colDateNaissance].trim());
        if (d) data.eleveDateNaissance = d;
      }
      if (colNomParent !== -1 && cols[colNomParent]?.trim()) data.nomParent = cols[colNomParent].trim();
      if (colTelUrgence !== -1 && cols[colTelUrgence]?.trim()) data.telephoneUrgence = cols[colTelUrgence].trim();
      if (colInfosMedicales !== -1 && cols[colInfosMedicales]?.trim()) data.infosMedicales = cols[colInfosMedicales].trim();
      if (colSexe !== -1 && cols[colSexe]?.trim()) {
        // Valeur non reconnue → null (l'organisateur catégorise à la main)
        const categorie = mapSexeToCategorie(cols[colSexe]);
        if (categorie) data.hebergementCategorie = categorie;
      }

      try {
        await this.prisma.autorisationParentale.create({ data });
        existingSet.add(key);
        results.created++;
      } catch {
        results.errors.push(`Ligne ${i + 1} : erreur pour ${prenom} ${nom}`);
      }
    }

    const columnsDetected = [
      colNom !== -1 && 'Nom',
      colPrenom !== -1 && 'Prénom',
      colEmail !== -1 && 'Email',
      colTaille !== -1 && 'Taille',
      colPoids !== -1 && 'Poids',
      colPointure !== -1 && 'Pointure',
      colNiveauSki !== -1 && 'Niveau ski',
      colRegime !== -1 && 'Régime',
      colDateNaissance !== -1 && 'Date naissance',
      colNomParent !== -1 && 'Nom parent',
      colTelUrgence !== -1 && 'Tél. urgence',
      colInfosMedicales !== -1 && 'Infos médicales',
      colSexe !== -1 && 'Sexe',
    ].filter(Boolean) as string[];

    return { ...results, emailColumnFound: colEmail !== -1, columnsDetected };
  }

  /** Création batch de participants en mode saisie directe (ORGANISATEUR). */
  async createBatchDirect(
    sejourId: string,
    participants: ParticipantDirectInput[],
    createurId: string,
  ) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    if (!Array.isArray(participants)) {
      throw new BadRequestException('participants doit être un tableau');
    }
    if (participants.length > 200) {
      throw new BadRequestException('Maximum 200 participants par appel');
    }

    // Dédupliquer par eleveNom+elevePrenom (case-insensitive), comme importCsv
    const existingAuths = await this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      select: { eleveNom: true, elevePrenom: true },
    });
    const existingSet = new Set(
      existingAuths.map((a) => `${a.eleveNom.toLowerCase()}|${a.elevePrenom.toLowerCase()}`),
    );

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const p of participants) {
      const nom = (p.eleveNom ?? '').trim();
      const prenom = (p.elevePrenom ?? '').trim();
      if (!nom || !prenom) {
        results.skipped++;
        continue;
      }
      const key = `${nom.toLowerCase()}|${prenom.toLowerCase()}`;
      if (existingSet.has(key)) {
        results.skipped++;
        continue;
      }
      try {
        await this.prisma.autorisationParentale.create({
          data: {
            sejourId,
            eleveNom: nom,
            elevePrenom: prenom,
            // Cascade 1 : "" / whitespace → null pour ne pas tenter d'email
            parentEmail: p.parentEmail?.trim() || null,
            taille: p.taille ?? null,
            poids: p.poids ?? null,
            pointure: p.pointure ?? null,
            niveauSki: p.niveauSki ?? null,
            regimeAlimentaire: p.regimeAlimentaire ?? null,
            infosMedicales: p.infosMedicales ?? null,
            nomParent: p.nomParent ?? null,
            telephoneUrgence: p.telephoneUrgence ?? null,
            // Cascade 2 : date invalide → null (jamais d'Invalid Date)
            eleveDateNaissance: parseDateOrNull(p.eleveDateNaissance),
            hebergementCategorie: p.hebergementCategorie ?? null,
            sourceInscription: 'SAISIE_DIRECTE',
            emailEnvoye: false,
            tokenExpiresAt: computeTokenExpiresAt(sejour.dateFin),
            ...(p.champsPersonnalises != null
              ? { champsPersonnalises: p.champsPersonnalises as Prisma.InputJsonValue }
              : {}),
          },
        });
        existingSet.add(key);
        results.created++;
      } catch {
        results.errors.push(`Erreur pour ${prenom} ${nom}`);
      }
    }

    return results;
  }

  /**
   * Mise à jour inline d'un participant (ORGANISATEUR).
   * Après signature : seuls les champs logistiques restent modifiables
   * (taille, poids, pointure, niveauSki, regimeAlimentaire, champsPersonnalises,
   * hebergementCategorie — donnée d'organisation interne, hors consentement parent).
   */
  async updateFields(id: string, body: ParticipantDirectInput, createurId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id },
      include: { sejour: { select: { createurId: true } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const signee = autorisation.signeeAt !== null;

    // Champs verrouillés après signature (le parent a consenti dessus)
    const CHAMPS_VERROUILLES = [
      'eleveNom', 'elevePrenom', 'parentEmail', 'eleveDateNaissance',
      'nomParent', 'telephoneUrgence', 'infosMedicales',
    ] as const;
    if (signee) {
      const b = body as Record<string, unknown>;
      const tentative = CHAMPS_VERROUILLES.some((k) => b[k] !== undefined);
      if (tentative) {
        throw new ForbiddenException(
          'Impossible de modifier une autorisation déjà signée par le parent',
        );
      }
    }

    // Construction EXPLICITE du data — jamais de spread du body (cascade 8 :
    // ne jamais toucher signeeAt, signatureHash, rgpdAccepte, paiement, etc.)
    const data: Prisma.AutorisationParentaleUpdateInput = {};

    // Logistiques (toujours autorisés)
    if (body.taille !== undefined) data.taille = body.taille ?? null;
    if (body.poids !== undefined) data.poids = body.poids ?? null;
    if (body.pointure !== undefined) data.pointure = body.pointure ?? null;
    if (body.niveauSki !== undefined) data.niveauSki = body.niveauSki ?? null;
    if (body.regimeAlimentaire !== undefined) data.regimeAlimentaire = body.regimeAlimentaire ?? null;
    // SC7 : organisation interne, pas de consentement parent → jamais verrouillé
    if (body.hebergementCategorie !== undefined) data.hebergementCategorie = body.hebergementCategorie ?? null;
    if (body.champsPersonnalises !== undefined) {
      data.champsPersonnalises =
        body.champsPersonnalises === null
          ? Prisma.JsonNull
          : (body.champsPersonnalises as Prisma.InputJsonValue);
    }

    // Verrouillés (seulement si non signée — garanti par le check ci-dessus)
    if (body.eleveNom !== undefined) data.eleveNom = (body.eleveNom ?? '').trim();
    if (body.elevePrenom !== undefined) data.elevePrenom = (body.elevePrenom ?? '').trim();
    if (body.parentEmail !== undefined) data.parentEmail = body.parentEmail?.trim() || null;
    if (body.nomParent !== undefined) data.nomParent = body.nomParent ?? null;
    if (body.telephoneUrgence !== undefined) data.telephoneUrgence = body.telephoneUrgence ?? null;
    if (body.infosMedicales !== undefined) data.infosMedicales = body.infosMedicales ?? null;
    if (body.eleveDateNaissance !== undefined) {
      data.eleveDateNaissance = parseDateOrNull(body.eleveDateNaissance);
    }

    return this.prisma.autorisationParentale.update({ where: { id }, data });
  }

  /** Suppression d'un participant (ORGANISATEUR) — interdite si signée. */
  async deleteAutorisation(id: string, createurId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id },
      include: { sejour: { select: { createurId: true } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    if (autorisation.signeeAt !== null)
      throw new ForbiddenException('Impossible de supprimer une autorisation signée');

    // Suppression des fichiers OVH associés (fire-and-forget — ne doit pas bloquer
    // la suppression). storage.delete() prend une URL et extrait la clé en interne.
    const urlsToDelete = [
      autorisation.documentMedicalUrl,
      autorisation.attestationAssuranceUrl,
    ].filter(Boolean) as string[];
    for (const url of urlsToDelete) {
      try {
        await this.storage.delete(url);
      } catch (err) {
        console.error(`[deleteAutorisation] Échec suppression fichier ${url}:`, err);
      }
    }

    // Les EleveGroupe liés sont supprimés en cascade (onDelete: Cascade).
    await this.prisma.autorisationParentale.delete({ where: { id } });
    return { deleted: true };
  }

  async getBySejour(sejourId: string, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
