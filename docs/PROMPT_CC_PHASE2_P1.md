# PROMPT CC — Phase 2 Partie 1 : Backend devis unifié + endpoints publics signature

> **Contexte** : Phase 1 (schema + planning) est déployée. On implémente maintenant :
> 1. Création de devis sur séjour DIRECT (sans DemandeDevis)
> 2. Envoi du devis par email avec lien de signature
> 3. Endpoints publics (sans JWT) pour la page de signature client
> 4. Signature → séjour passe de OPTION à CONVENTION
>
> **Référence** : `docs/ARCHITECTURE_SEJOUR_DIRECT.md` sections 3.3 à 3.5
> **Règle** : Lire chaque fichier AVANT de le modifier. Ne jamais déduire le contenu.

---

## ÉTAPE 1 — Adapter CreateDevisDto : demandeId optionnel + sejourDirectId

Lire `backend/src/devis/dto/create-devis.dto.ts`.

Modifier `CreateDevisDto` :

1. Changer `demandeId` de `@IsUUID()` required en `@IsOptional() @IsUUID()` :

```typescript
  @IsOptional()
  @IsUUID()
  demandeId?: string;
```

2. Ajouter après `demandeId` :

```typescript
  @IsOptional()
  @IsUUID()
  sejourDirectId?: string;
```

---

## ÉTAPE 2 — Méthode createDirectDevis() dans DevisService

Lire `backend/src/devis/devis.service.ts` en entier.

Ajouter cette méthode dans la classe `DevisService` (NE PAS modifier `create()` existant) :

```typescript
  /**
   * Créer un devis sur un séjour en gestion DIRECT (pas de DemandeDevis).
   * Le devis est lié au séjour via sejourDirectId.
   */
  async createDirectDevis(
    dto: CreateDevisDto,
    userId: string,
    file?: Express.Multer.File,
    centreId?: string | null,
  ) {
    if (!dto.sejourDirectId) {
      throw new ForbiddenException('sejourDirectId est requis pour un devis direct');
    }

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Vérifier le séjour
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourDirectId },
      select: {
        id: true,
        modeGestion: true,
        hebergementSelectionneId: true,
        titre: true,
        clientNom: true,
        clientEmail: true,
        deletedAt: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Ce séjour n\'est pas en gestion directe');
    }
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    // Vérifier pas de devis actif existant
    const devisExistant = await this.prisma.devis.findFirst({
      where: {
        sejourDirectId: dto.sejourDirectId,
        statut: {
          in: [
            StatutDevis.EN_ATTENTE,
            StatutDevis.EN_ATTENTE_VALIDATION,
            StatutDevis.SELECTIONNE,
          ],
        },
      },
    });
    if (devisExistant) {
      throw new ForbiddenException('Un devis actif existe déjà pour ce séjour');
    }

    const numeroDevis = dto.numeroDevis ?? await this.generateNumeroDevis(centre.id);

    let documentUrl: string | null = null;
    if (file && file.mimetype === 'application/pdf') {
      documentUrl = await this.storage.upload(file, 'devis');
    }

    const devis = await this.prisma.devis.create({
      data: {
        sejourDirectId: dto.sejourDirectId,
        demandeId: null,
        centreId: centre.id,
        montantTotal: dto.montantTotal ?? '0',
        montantParEleve: dto.montantParEleve ?? '0',
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
        documentUrl,
        nomEntreprise: dto.nomEntreprise,
        adresseEntreprise: dto.adresseEntreprise,
        siretEntreprise: dto.siretEntreprise,
        emailEntreprise: dto.emailEntreprise,
        telEntreprise: dto.telEntreprise,
        tauxTva: dto.tauxTva,
        montantHT: dto.montantHT,
        montantTVA: dto.montantTVA,
        montantTTC: dto.montantTTC,
        pourcentageAcompte: dto.pourcentageAcompte,
        montantAcompte: dto.montantAcompte,
        numeroDevis,
        typeDevis: 'PLATEFORME',
      },
    });

    if (dto.lignes && dto.lignes.length > 0) {
      await this.prisma.ligneDevis.createMany({
        data: dto.lignes.map((l) => ({
          devisId: devis.id,
          description: l.description,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? 0,
          totalHT: l.totalHT,
          totalTTC: l.totalTTC,
        })),
      });
    }

    return this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });
  }
```

---

## ÉTAPE 3 — Méthode envoyerDevisDirect() dans DevisService

Ajouter cette méthode dans `DevisService` :

```typescript
  /**
   * Envoie un devis DIRECT par email au client avec lien de signature.
   * Le devis passe en EN_ATTENTE.
   */
  async envoyerDevisDirect(
    devisId: string,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: true,
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            clientNom: true, clientEmail: true, clientOrganisation: true,
            modeGestion: true, placesTotales: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) throw new ForbiddenException();
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new ForbiddenException('Ce devis n\'est pas un devis direct');
    }
    if (devis.sejourDirect.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Le séjour n\'est pas en gestion directe');
    }

    const clientEmail = devis.sejourDirect.clientEmail;
    if (!clientEmail) {
      throw new ForbiddenException('L\'email du client est requis pour envoyer le devis');
    }

    // Passer le devis en EN_ATTENTE si brouillon
    if (devis.statut === 'EN_ATTENTE') {
      // Déjà en attente, on renvoie juste l'email
    } else {
      await this.prisma.devis.update({
        where: { id: devisId },
        data: { statut: StatutDevis.EN_ATTENTE },
      });
    }

    const token = devis.tokenSignature;
    if (!token) {
      throw new ForbiddenException('Token de signature manquant sur le devis');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const sejour = devis.sejourDirect;

    await this.email.sendGenericNotification(
      clientEmail,
      `Devis ${devis.numeroDevis ?? ''} — ${centre.nom}`,
      `<p>Bonjour${sejour.clientNom ? ` ${sejour.clientNom}` : ''},</p>
       <p>Veuillez trouver ci-joint le devis pour :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.titre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Participants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.placesTotales}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant TTC</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td></tr>
       </table>
       <p>Consultez le devis complet et signez-le en ligne :</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/devis/signer/${token}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Si vous ne pouvez pas cliquer sur le bouton, copiez ce lien : ${frontendUrl}/devis/signer/${token}</p>`,
      centre.nom,
    );

    // Log CRM
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: sejour.id },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: centre.id,
            type: 'DEVIS',
            description: `Devis ${devis.numeroDevis ?? ''} envoyé — ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`,
            metadata: { devisId, sejourId: sejour.id },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Devis envoyé par email' };
  }
```

---

## ÉTAPE 4 — Endpoints publics (sans JWT) pour signature

### 4A. Créer un nouveau controller : `backend/src/devis/devis-public.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { DevisService } from './devis.service.js';

@Controller('devis/public')
export class DevisPublicController {
  constructor(private readonly devisService: DevisService) {}

  /** GET /devis/public/:token — Données publiques du devis pour la page de signature */
  @Get(':token')
  getDevisPublic(@Param('token') token: string) {
    return this.devisService.getDevisPublicByToken(token);
  }

  /** POST /devis/public/:token/signer — Signature directe par le client */
  @Post(':token/signer')
  signerDirect(
    @Param('token') token: string,
    @Body() body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
    @Req() req: Request,
  ) {
    return this.devisService.signerDevisDirect(token, body, req);
  }

  /** POST /devis/public/:token/envoyer-direction — Déléguer la signature à la direction */
  @Post(':token/envoyer-direction')
  envoyerDirection(
    @Param('token') token: string,
    @Body() body: { emailDirecteur: string; nomDirecteur?: string },
  ) {
    return this.devisService.envoyerADirection(token, body);
  }

  /** POST /devis/public/:token/upload-signature — Upload scan signé */
  @Post(':token/upload-signature')
  @UseInterceptors(FileInterceptor('file'))
  uploadSignaturePublic(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.devisService.uploadSignaturePublic(token, file, req);
  }
}
```

### 4B. Enregistrer le controller dans le module

Lire `backend/src/devis/devis.module.ts`.

Ajouter l'import et le controller :

```typescript
import { DevisPublicController } from './devis-public.controller.js';

@Module({
  imports: [AuthModule, ClientsModule],
  controllers: [DevisController, DevisPublicController],
  providers: [DevisService],
})
export class DevisModule {}
```

---

## ÉTAPE 5 — Méthodes service pour les endpoints publics

Ajouter ces 4 méthodes dans `DevisService` :

```typescript
  /**
   * Retourne les données publiques d'un devis via son token de signature.
   * Utilisé par la page /devis/signer/[token] (pas de JWT).
   */
  async getDevisPublicByToken(token: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        lignes: true,
        centre: {
          select: {
            nom: true, ville: true, adresse: true, codePostal: true,
            siret: true, telephone: true, email: true,
            tvaIntracommunautaire: true, iban: true,
            brochureUrl: true, conditionsAnnulation: true,
          },
        },
        sejourDirect: {
          select: {
            id: true, titre: true, lieu: true,
            dateDebut: true, dateFin: true, placesTotales: true,
            clientNom: true, clientPrenom: true, clientEmail: true,
            clientOrganisation: true, natureSejour: true, typeSejour: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Lien de signature invalide');
    if (!devis.sejourDirectId) {
      throw new NotFoundException('Ce devis n\'utilise pas la signature par lien');
    }

    // Vérifier si déjà signé
    const isSigned = devis.statut === 'SELECTIONNE' || devis.statut === 'SIGNE_DIRECTION'
      || devis.statut === 'FACTURE_ACOMPTE' || devis.statut === 'FACTURE_SOLDE';

    return {
      id: devis.id,
      numeroDevis: devis.numeroDevis,
      statut: devis.statut,
      montantHT: devis.montantHT,
      montantTVA: devis.montantTVA,
      montantTTC: devis.montantTTC,
      tauxTva: devis.tauxTva,
      pourcentageAcompte: devis.pourcentageAcompte,
      montantAcompte: devis.montantAcompte,
      description: devis.description,
      conditionsAnnulation: devis.conditionsAnnulation,
      nomEntreprise: devis.nomEntreprise,
      adresseEntreprise: devis.adresseEntreprise,
      siretEntreprise: devis.siretEntreprise,
      emailEntreprise: devis.emailEntreprise,
      telEntreprise: devis.telEntreprise,
      createdAt: devis.createdAt,
      lignes: devis.lignes,
      centre: devis.centre,
      sejour: devis.sejourDirect,
      isSigned,
      signatureDirecteur: devis.signatureDirecteur,
      nomSignataireDirecteur: devis.nomSignataireDirecteur,
      dateSignatureDirecteur: devis.dateSignatureDirecteur,
      signatureDocumentUrl: devis.signatureDocumentUrl,
    };
  }

  /**
   * Signature directe par le client (option 1 de la page publique).
   * Le devis passe EN_ATTENTE → SELECTIONNE, le séjour OPTION → CONVENTION.
   */
  async signerDevisDirect(
    token: string,
    body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
    req: Request,
  ) {
    if (!body.confirmation) {
      throw new ForbiddenException('Vous devez accepter les conditions pour signer');
    }
    if (!body.nomSignataire?.trim()) {
      throw new ForbiddenException('Le nom du signataire est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        centre: { select: { nom: true, email: true } },
        sejourDirect: { select: { id: true, titre: true, clientEmail: true, clientNom: true, dateDebut: true, dateFin: true, modeGestion: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible à la signature par lien');
    }
    if (devis.statut !== 'EN_ATTENTE') {
      throw new ForbiddenException('Ce devis ne peut plus être signé (statut actuel : ' + devis.statut + ')');
    }

    const now = new Date();
    const hash = createHash('sha256')
      .update(`${token}${body.nomSignataire}${now.toISOString()}${devis.montantTTC ?? '0'}`)
      .digest('hex');

    // Mettre à jour le devis → SELECTIONNE
    await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: StatutDevis.SELECTIONNE,
        signatureDirecteur: `Signé électroniquement par ${body.nomSignataire}${body.fonctionSignataire ? ` (${body.fonctionSignataire})` : ''} — ${now.toLocaleDateString('fr-FR')}`,
        nomSignataireDirecteur: body.nomSignataire.trim(),
        dateSignatureDirecteur: now,
        signatureIpAddress: req.ip ?? null,
        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
        signatureHash: hash,
      },
    });

    // Séjour OPTION → CONVENTION
    await this.prisma.sejour.update({
      where: { id: devis.sejourDirect.id },
      data: {
        statut: StatutSejour.CONVENTION,
        hebergementSelectionneId: devis.centreId,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const sejour = devis.sejourDirect;

    // Email confirmation client
    if (sejour.clientEmail) {
      try {
        await this.email.sendGenericNotification(
          sejour.clientEmail,
          `Confirmation de réservation — ${sejour.titre}`,
          `<p>Bonjour${sejour.clientNom ? ` ${sejour.clientNom}` : ''},</p>
           <p>Nous confirmons la signature du devis <strong>${devis.numeroDevis}</strong> pour <strong>${sejour.titre}</strong>
           du ${fmt(sejour.dateDebut)} au ${fmt(sejour.dateFin)}.</p>
           <p><strong>Signé par :</strong> ${body.nomSignataire}<br>
           <strong>Date :</strong> ${fmt(now)}</p>
           <p>Un acompte de <strong>${Number(devis.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>
           est à régler selon les conditions convenues.</p>`,
          devis.centre?.nom,
        );
      } catch { /* non bloquant */ }
    }

    // Email notification hébergeur
    if (devis.centre?.email) {
      try {
        await this.email.sendGenericNotification(
          devis.centre.email,
          `Devis signé — ${sejour.titre} · ${sejour.clientNom ?? 'Client'}`,
          `<p>Le devis <strong>${devis.numeroDevis}</strong> a été signé électroniquement.</p>
           <p><strong>Signataire :</strong> ${body.nomSignataire}<br>
           <strong>Séjour :</strong> ${sejour.titre}<br>
           <strong>Dates :</strong> ${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}<br>
           <strong>Montant TTC :</strong> ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
           <p style="margin:24px 0">
             <a href="${frontendUrl}/dashboard/hebergeur/planning" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
               Voir le planning
             </a>
           </p>`,
        );
      } catch { /* non bloquant */ }
    }

    // Log CRM
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: sejour.id },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: devis.centreId,
            type: 'SIGNATURE',
            description: `Devis ${devis.numeroDevis ?? ''} signé par ${body.nomSignataire}`,
            metadata: { devisId: devis.id, sejourId: sejour.id },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Devis signé avec succès' };
  }

  /**
   * Déléguer la signature à la direction (option 2 de la page publique).
   * Crée une InvitationDirecteur et envoie l'email.
   */
  async envoyerADirection(
    token: string,
    body: { emailDirecteur: string; nomDirecteur?: string },
  ) {
    if (!body.emailDirecteur?.trim()) {
      throw new ForbiddenException('L\'email du signataire est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        sejourDirect: {
          select: {
            id: true, titre: true, clientNom: true,
            clientOrganisation: true, clientOrganisationId: true,
          },
        },
        centre: { select: { nom: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible');
    }
    if (devis.statut !== 'EN_ATTENTE') {
      throw new ForbiddenException('Ce devis ne peut plus être envoyé à la direction');
    }

    const { randomUUID } = await import('crypto');
    const invToken = randomUUID();
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const sejour = devis.sejourDirect;

    await this.prisma.invitationDirecteur.create({
      data: {
        token: invToken,
        sejourId: sejour.id,
        devisId: devis.id,
        emailDirecteur: body.emailDirecteur.trim(),
        enseignantPrenom: sejour.clientNom ?? 'L\'organisateur',
        sejourTitre: sejour.titre,
        etablissementNom: sejour.clientOrganisation ?? null,
        organisationId: sejour.clientOrganisationId ?? null,
        typeContexte: 'SCOLAIRE',
      },
    });

    // Passer le devis en EN_ATTENTE_VALIDATION
    await this.prisma.devis.update({
      where: { id: devis.id },
      data: { statut: StatutDevis.EN_ATTENTE_VALIDATION },
    });

    await this.email.sendGenericNotification(
      body.emailDirecteur.trim(),
      `Devis à valider — ${sejour.titre}`,
      `<p>Bonjour,</p>
       <p>${sejour.clientNom ?? 'Un organisateur'} vous invite à consulter et signer le devis pour le séjour <strong>${sejour.titre}</strong> au centre <strong>${devis.centre?.nom ?? ''}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/invitation-direction/${invToken}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Consulter et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Si vous n'êtes pas concerné par cette demande, vous pouvez ignorer cet email.</p>`,
      devis.centre?.nom,
    );

    return { success: true, message: 'Invitation envoyée à la direction' };
  }

  /**
   * Upload scan signé par le client (option 3 de la page publique).
   * Le devis passe SELECTIONNE, le séjour OPTION → CONVENTION.
   */
  async uploadSignaturePublic(token: string, file: Express.Multer.File, req: Request) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new ForbiddenException('Un fichier PDF est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        sejourDirect: { select: { id: true, titre: true, modeGestion: true } },
        centre: { select: { nom: true, email: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible');
    }
    if (devis.statut !== 'EN_ATTENTE' && devis.statut !== 'EN_ATTENTE_VALIDATION') {
      throw new ForbiddenException('Ce devis ne peut plus recevoir de document signé');
    }

    const documentUrl = await this.storage.upload(file, 'signatures');

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: StatutDevis.SELECTIONNE,
        signatureDocumentUrl: documentUrl,
        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
      },
    });

    // Séjour → CONVENTION
    await this.prisma.sejour.update({
      where: { id: devis.sejourDirect.id },
      data: { statut: StatutSejour.CONVENTION },
    });

    // Notification hébergeur
    if (devis.centre?.email) {
      try {
        const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
        await this.email.sendGenericNotification(
          devis.centre.email,
          `Document signé reçu — ${devis.sejourDirect.titre}`,
          `<p>Un document signé a été uploadé pour le devis <strong>${devis.numeroDevis}</strong>.</p>
           <p style="margin:24px 0">
             <a href="${frontendUrl}/dashboard/hebergeur/planning" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
               Voir le planning
             </a>
           </p>`,
        );
      } catch { /* non bloquant */ }
    }

    return { success: true, message: 'Document signé reçu' };
  }
```

---

## ÉTAPE 6 — Routes privées (hébergeur) pour création + envoi devis direct

Dans `backend/src/devis/devis.controller.ts`, ajouter ces routes.

Ajouter AVANT la route `@Get('mes-devis')` (routes statiques avant paramétriques) :

```typescript
  /** POST /devis/direct — Créer un devis sur séjour DIRECT */
  @Post('direct')
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  createDirect(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.createDirectDevis(dto, user.id, file, centreId);
  }
```

Ajouter APRÈS la route `@Post(':id/versements')` :

```typescript
  /** POST /devis/:id/envoyer-direct — Envoyer un devis DIRECT par email */
  @Post(':id/envoyer-direct')
  @Roles(Role.HEBERGEUR)
  envoyerDirect(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.envoyerDevisDirect(id, user.id, centreId);
  }
```

---

## ÉTAPE 7 — Import createHash dans devis.service.ts

Vérifier que `createHash` est importé en haut de `devis.service.ts`. Si déjà présent (import `{ createHash } from 'node:crypto'`), ne rien faire. Sinon ajouter.

Vérifier aussi que `Request` est importé depuis express :
```typescript
import type { Request } from 'express';
```

---

## ÉTAPE 8 — Build et vérification

```bash
cd backend
npx prisma generate
npm run build
```

Vérifier : 0 erreur TypeScript.

---

## RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `backend/src/devis/dto/create-devis.dto.ts` | demandeId optional + sejourDirectId |
| `backend/src/devis/devis.service.ts` | +4 méthodes : createDirectDevis, envoyerDevisDirect, getDevisPublicByToken, signerDevisDirect, envoyerADirection, uploadSignaturePublic |
| `backend/src/devis/devis.controller.ts` | +2 routes : POST /direct, POST /:id/envoyer-direct |
| `backend/src/devis/devis-public.controller.ts` | CRÉÉ — 4 endpoints publics sans JWT |
| `backend/src/devis/devis.module.ts` | Ajout DevisPublicController |

## FICHIERS À NE PAS MODIFIER
- `frontend/**` — Phase 2 Partie 2
- `backend/src/devis-libres/**` — Phase 5
- `backend/src/invitations-directeur/**` — utilise le flux existant tel quel
