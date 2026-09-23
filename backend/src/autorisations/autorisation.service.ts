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
import { peutEcrireSejourEnPropre, peutGererEnPropre, peutLireSejourHebergeur } from '../common/sejour-ownership.js';

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
  // Lot 5a refonte inscriptions : champs santé structurés (colonnes Lot 1)
  allergies?: string | null;
  // Lot 5a-bis : FOURNIE | NON_FOURNIE | NON_CONCERNE (validé par le DTO)
  attestationAquatique?: string | null;
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

// Lot 6 — normalisation commune des valeurs CSV : majuscules, sans accents,
// underscores/tirets → espaces (reconnaît à la fois les valeurs canoniques
// d'un ré-import d'export et les libellés humains).
function normaliserValeurCsv(val: string): string {
  return val
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lot 6 — mappe PRUDEMMENT une valeur CSV d'attestation aquatique vers l'enum
// applicative. Toute valeur non reconnue → null (jamais une valeur hors enum).
function mapAttestation(val: string): 'FOURNIE' | 'NON_FOURNIE' | 'NON_CONCERNE' | null {
  const n = normaliserValeurCsv(val);
  if (['FOURNIE', 'OUI'].includes(n)) return 'FOURNIE';
  if (['NON FOURNIE', 'NON'].includes(n)) return 'NON_FOURNIE';
  if (['NON CONCERNE', 'NA'].includes(n)) return 'NON_CONCERNE';
  return null;
}

// Lot 6 — idem pour le niveau de ski : la grille affiche un select sur les
// valeurs canoniques ; un texte brut (« Débutant ») serait stocké mais
// invisible dans le select. Non reconnu → null.
function mapNiveauSki(val: string): string | null {
  const n = normaliserValeurCsv(val);
  if (n === 'DEBUTANT') return 'DEBUTANT';
  if (n === 'INTERMEDIAIRE') return 'INTERMEDIAIRE';
  if (n === 'CONFIRME') return 'CONFIRME';
  if (n === 'HORS PISTE') return 'HORS_PISTE';
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
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: { createurId: true, titre: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true, nom: true, email: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId && !(await peutEcrireSejourEnPropre(this.prisma, sejour, createurId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    // B3b : séjour géré en propre → l'email part au nom du centre, réponse au
    // centre. Refus net AVANT toute boucle si le centre n'a pas d'email de
    // contact — aucun envoi partiel, et jamais d'email auquel on ne peut pas répondre.
    const enPropre = peutGererEnPropre(sejour, createurId);
    if (enPropre && !sejour.hebergementSelectionne?.email?.trim()) {
      throw new BadRequestException(
        'Renseignez l\'email de contact de votre centre avant d\'envoyer aux familles : les parents doivent pouvoir vous répondre.',
      );
    }
    const identiteCentre = enPropre && sejour.hebergementSelectionne?.email
      ? { name: sejour.hebergementSelectionne.nom, email: sejour.hebergementSelectionne.email }
      : undefined;

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
          identiteCentre?.name,
          identiteCentre,
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

  /**
   * P10 — envoie le lien PERSONNEL du journal (/sejour/{tokenAcces}/journal) à
   * toutes les familles ayant un email, sans passer par le mail d'autorisation.
   * Ne touche PAS emailEnvoye (flag de l'autorisation). Un lien par famille :
   * jamais de lien unique par séjour (sécurité photos de mineurs).
   */
  async envoyerLienJournal(sejourId: string, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const autorisations = await this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      select: { parentEmail: true, elevePrenom: true, tokenAcces: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const aut of autorisations) {
      if (!aut.parentEmail || !aut.tokenAcces) {
        skipped++;
        continue;
      }
      const lien = `${FRONTEND_URL}/sejour/${aut.tokenAcces}/journal`;
      try {
        await this.email.sendLienJournal(aut.parentEmail, aut.elevePrenom, sejour.titre, lien);
        sent++;
      } catch {
        skipped++;
      }
    }

    return { sent, skipped };
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
            // Lot 7a : snapshot des champs d'inscription (formulaire parent dynamique)
            champsInscription: true,
            // B3b : dérivation « géré en propre » + contact du centre — lus pour le
            // CALCUL uniquement, jamais renvoyés bruts (route publique sans guard)
            modeGestion: true,
            createurId: true,
            hebergementSelectionne: { select: { nom: true, email: true } },
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

    // B3b : « géré en propre par le centre » (colo/stage du centre, sans
    // organisateur) — calculé ici, le front ne re-dérive pas la règle métier.
    const gereParLeCentre =
      sejour.modeGestion === 'DIRECT' && sejour.createurId === null && sejour.hebergementSelectionne != null;

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
        champsInscription: sejour.champsInscription,
      },
      hebergement,
      gereParLeCentre,
      // Contact du centre : exposé UNIQUEMENT en propre (en scolaire, le
      // responsable de traitement est l'établissement — rien à afficher)
      centreContact: gereParLeCentre && sejour.hebergementSelectionne
        ? { nom: sejour.hebergementSelectionne.nom, email: sejour.hebergementSelectionne.email }
        : null,
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
        // Lot 7a : santé structurée + attestation (formulaire parent dynamique)
        allergies: dto.allergies ?? null,
        attestationAquatique: dto.attestationAquatique ?? null,
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
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: { hebergementSelectionne: { select: { userId: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    // Lot 6 : même double-motif que createBatchDirect/updateFields — créateur
    // OU hébergeur en propre (DIRECT, propriétaire ou collaborateur sejours:WRITE).
    if (sejour.createurId !== createurId && !(await peutEcrireSejourEnPropre(this.prisma, sejour, createurId))) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

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

    // Lot 6 : « nom » est une sous-chaîne de « prénom » ET de « nom du parent » —
    // la colonne nom-élève = un header contenant « nom » sans être prénom/parent.
    const colNom = headers.findIndex(
      (h) =>
        h.includes('nom') &&
        !h.includes('prénom') && !h.includes('prenom') &&
        !h.includes('parent') && !h.includes('responsable'),
    );
    const colPrenom = findCol(['prénom', 'prenom']);
    const colEmail = findCol(['email', 'mail', 'courriel', 'e-mail']);
    const colTaille = findCol(['taille', 'taille (cm)', 'taille cm']);
    const colPoids = findCol(['poids', 'poids (kg)', 'poids kg']);
    const colPointure = findCol(['pointure', 'pointure ski', 'taille chaussure']);
    const colNiveauSki = findCol(['ski', 'niveau ski', 'niveau de ski']);
    // Lot 6 : allergies séparées du régime (colonne dédiée depuis 5a)
    const colRegime = findCol(['régime', 'regime', 'régime alimentaire', 'regime alimentaire']);
    const colAllergies = findCol(['allergie', 'allergies', 'intolérance', 'intolerance']);
    const colAttestation = findCol(['attestation', 'aquatique', 'savoir-nager', 'aisance aquatique']);
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
      if (colNiveauSki !== -1 && cols[colNiveauSki]?.trim()) {
        // Lot 6 : valeur canonique uniquement (le select de la grille n'affiche
        // pas un texte brut) ; non reconnu → rien d'écrit
        const niveauSki = mapNiveauSki(cols[colNiveauSki]);
        if (niveauSki) data.niveauSki = niveauSki;
      }
      if (colRegime !== -1 && cols[colRegime]?.trim()) data.regimeAlimentaire = cols[colRegime].trim();
      if (colAllergies !== -1 && cols[colAllergies]?.trim()) data.allergies = cols[colAllergies].trim();
      if (colAttestation !== -1 && cols[colAttestation]?.trim()) {
        const attestation = mapAttestation(cols[colAttestation]);
        if (attestation) data.attestationAquatique = attestation;
      }
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
      colAttestation !== -1 && 'Attestation aquatique',
      colRegime !== -1 && 'Régime',
      colAllergies !== -1 && 'Allergies',
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
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        createurId: true,
        modeGestion: true,
        dateFin: true,
        hebergementSelectionneId: true,
        hebergementSelectionne: { select: { userId: true } },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId && !(await peutEcrireSejourEnPropre(this.prisma, sejour, createurId))) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

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
            allergies: p.allergies ?? null,
            attestationAquatique: p.attestationAquatique ?? null,
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
      include: { sejour: { select: { createurId: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true } } } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== createurId && !(await peutEcrireSejourEnPropre(this.prisma, autorisation.sejour, createurId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const signee = autorisation.signeeAt !== null;

    // Champs verrouillés après signature (le parent a consenti dessus)
    const CHAMPS_VERROUILLES = [
      'eleveNom', 'elevePrenom', 'parentEmail', 'eleveDateNaissance',
      'nomParent', 'telephoneUrgence', 'infosMedicales',
      // Lot 5a : donnée de santé, même régime qu'infosMedicales (consentement parent)
      'allergies',
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
    // Lot 5a-bis : attestation aquatique = logistique (comme taille/pointure),
    // modifiable après signature — PAS dans CHAMPS_VERROUILLES
    if (body.attestationAquatique !== undefined) data.attestationAquatique = body.attestationAquatique ?? null;
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
    // Lot 5a : santé, verrouillé après signature (dans CHAMPS_VERROUILLES)
    if (body.allergies !== undefined) data.allergies = body.allergies ?? null;
    if (body.eleveDateNaissance !== undefined) {
      data.eleveDateNaissance = parseDateOrNull(body.eleveDateNaissance);
    }

    return this.prisma.autorisationParentale.update({ where: { id }, data });
  }

  /**
   * Validation manuelle « papier signé reçu » (organisateur/hébergeur en propre).
   * Pas de signatureHash ni d'IP : ce N'EST PAS une signature électronique —
   * juste un signeeAt posé + le flag signeeManuellement (annulable).
   */
  async validerSignatureManuelle(id: string, userId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id },
      include: { sejour: { select: { createurId: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true } } } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== userId && !(await peutEcrireSejourEnPropre(this.prisma, autorisation.sejour, userId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    if (autorisation.signeeAt !== null)
      throw new ConflictException('Autorisation déjà signée');

    return this.prisma.autorisationParentale.update({
      where: { id },
      data: { signeeAt: new Date(), signeeManuellement: true },
    });
  }

  /** Annulation d'une validation manuelle — les signatures en ligne sont protégées. */
  async annulerSignatureManuelle(id: string, userId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id },
      include: { sejour: { select: { createurId: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true } } } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== userId && !(await peutEcrireSejourEnPropre(this.prisma, autorisation.sejour, userId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    if (autorisation.signeeManuellement !== true)
      throw new ForbiddenException('Seule une validation manuelle peut être annulée');

    return this.prisma.autorisationParentale.update({
      where: { id },
      data: { signeeAt: null, signeeManuellement: false },
    });
  }

  /** Validation manuelle en masse — mêmes permissions que l'unitaire, même flag.
   * Le filtre signeeAt: null est OBLIGATOIRE : ne jamais retoucher une ligne déjà
   * signée (en ligne OU manuelle). */
  async validerSignaturesBatch(sejourId: string, userId: string, autorisationIds?: string[]) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: { createurId: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId && !(await peutEcrireSejourEnPropre(this.prisma, sejour, userId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const { count } = await this.prisma.autorisationParentale.updateMany({
      where: {
        sejourId,
        signeeAt: null,
        ...(autorisationIds?.length ? { id: { in: autorisationIds } } : {}),
      },
      data: { signeeAt: new Date(), signeeManuellement: true },
    });
    return { count };
  }

  /** Suppression d'un participant (ORGANISATEUR) — interdite si signée. */
  async deleteAutorisation(id: string, createurId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id },
      include: { sejour: { select: { createurId: true, modeGestion: true, hebergementSelectionneId: true, hebergementSelectionne: { select: { userId: true } } } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.sejour.createurId !== createurId && !(await peutEcrireSejourEnPropre(this.prisma, autorisation.sejour, createurId)))
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
      include: { hebergementSelectionne: { select: { userId: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    // Miroir hébergeur (Lot 3) : lecture aussi ouverte à l'hébergeur du centre
    // (propriétaire ou collaborateur sejours:READ) — createurId = user.id de la route.
    if (sejour.createurId !== createurId && !(await peutLireSejourHebergeur(this.prisma, sejour, createurId)))
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
