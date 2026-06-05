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
}

// Parse une date ISO ; retourne null si absente ou invalide (jamais d'Invalid Date)
function parseDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
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

    if (colNom === -1) throw new BadRequestException('Colonne "Nom" introuvable. Colonnes détectées : ' + headers.join(', '));
    if (colPrenom === -1) throw new BadRequestException('Colonne "Prénom" introuvable. Colonnes détectées : ' + headers.join(', '));
    if (colEmail === -1) throw new BadRequestException('Colonne "Email" introuvable. Colonnes détectées : ' + headers.join(', '));

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
      const email = cols[colEmail]?.trim();

      if (!nom || !prenom) {
        results.skipped++;
        continue;
      }
      if (!email || !email.includes('@')) {
        results.errors.push(`Ligne ${i + 1} : email manquant ou invalide pour ${prenom} ${nom}`);
        results.skipped++;
        continue;
      }

      const key = `${nom.toLowerCase()}|${prenom.toLowerCase()}`;
      if (existingSet.has(key)) {
        results.skipped++;
        continue;
      }

      try {
        await this.createSansEmail(
          { sejourId, eleveNom: nom.toUpperCase(), elevePrenom: prenom, parentEmail: email },
          createurId,
        );
        existingSet.add(key);
        results.created++;
      } catch {
        results.errors.push(`Ligne ${i + 1} : erreur pour ${prenom} ${nom}`);
      }
    }

    return results;
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
            sourceInscription: 'SAISIE_DIRECTE',
            emailEnvoye: false,
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
   * (taille, poids, pointure, niveauSki, regimeAlimentaire, champsPersonnalises).
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
