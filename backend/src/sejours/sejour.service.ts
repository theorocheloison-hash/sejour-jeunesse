import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role, StatutSejour, StatutDevis, AppelOffreStatut, TypeContexteSejour, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import { CreateSejourDirectDto } from './dto/create-sejour-direct.dto.js';
import { UpdateSejourDto } from './dto/update-sejour.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { assertSignataireCanAccessSejour } from '../auth/ownership.helper.js';
import { formatParticipants } from '../utils/format.js';
import { buildPeriodeLabel } from '../demandes/demande.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://liavo.fr';

@Injectable()
export class SejourService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateSejourDto, createurId: string) {
    return this.prisma.sejour.create({
      data: {
        titre:                    dto.titre,
        description:              dto.informationsComplementaires,
        lieu:                     dto.zoneGeographique,
        ...(dto.dateDebut ? { dateDebut: new Date(dto.dateDebut) } : {}),
        ...(dto.dateFin ? { dateFin: new Date(dto.dateFin) } : {}),
        moisSouhaite:             dto.moisSouhaite ?? null,
        anneeSouhaitee:           dto.anneeSouhaitee ?? null,
        noteDateFlexible:         dto.noteDateFlexible ?? null,
        dureeNuits:               dto.dureeNuits ?? null,
        placesTotales:            dto.nombreEleves,
        placesRestantes:          dto.nombreEleves,
        niveauClasse:             dto.niveauClasse ?? null,
        thematiquesPedagogiques:  dto.thematiquesPedagogiques,
        regionSouhaitee:          `${dto.typeZone}:${dto.zoneGeographique}`,
        dateButoireDevis:         dto.dateButoireDevis ? new Date(dto.dateButoireDevis) : null,
        nombreAccompagnateurs:    dto.nombreAccompagnateurs ?? null,
        heureArrivee:             dto.heureArrivee ?? null,
        heureDepart:              dto.heureDepart ?? null,
        transportAller:           dto.transportAller ?? null,
        transportSurPlace:        dto.transportSurPlace ?? null,
        activitesSouhaitees:      dto.activitesSouhaitees ?? null,
        budgetMaxParEleve:        dto.budgetMaxParEleve ?? null,
        ageMin:                   dto.ageMin ?? null,
        ageMax:                   dto.ageMax ?? null,
        moinsde6ans:              dto.moinsde6ans ?? false,
        typeAccueilACM:           dto.typeAccueilACM ?? null,
        projetEducatif:           dto.projetEducatif ?? null,
        typeContexte:             dto.typeContexte ?? TypeContexteSejour.SCOLAIRE,
        createurId,
      },
    });
  }

  async creerDepuisCatalogue(dto: {
    centreId: string;
    titre: string;
    dateDebut: string;
    dateFin: string;
    nombreEleves: number;
    message?: string;
    nombreAccompagnateurs?: number;
    heureArrivee?: string;
    heureDepart?: string;
    transportAller?: string;
    transportSurPlace?: boolean;
    activitesSouhaitees?: string;
    budgetMaxParEleve?: number;
  }, enseignantId: string) {
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: dto.centreId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.statut !== 'ACTIVE') throw new ForbiddenException('Ce centre n\'est pas disponible');

    const result = await this.prisma.$transaction(async (tx) => {
      const sejour = await tx.sejour.create({
        data: {
          titre: dto.titre,
          lieu: centre.ville,
          dateDebut: new Date(dto.dateDebut),
          dateFin: new Date(dto.dateFin),
          placesTotales: dto.nombreEleves,
          placesRestantes: dto.nombreEleves,
          statut: 'CONVENTION',
          createurId: enseignantId,
          hebergementSelectionneId: centre.id,
          regionSouhaitee: `VILLE:${centre.ville}`,
        },
      });

      await tx.demandeDevis.create({
        data: {
          sejourId: sejour.id,
          enseignantId,
          titre: dto.titre,
          dateDebut: new Date(dto.dateDebut),
          dateFin: new Date(dto.dateFin),
          nombreEleves: dto.nombreEleves,
          villeHebergement: centre.ville,
          statut: 'OUVERTE',
          typePension: [],
          nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
          heureArrivee:          dto.heureArrivee ?? null,
          heureDepart:           dto.heureDepart ?? null,
          activitesSouhaitees:   dto.activitesSouhaitees ?? null,
          budgetMaxParEleve:     dto.budgetMaxParEleve ?? null,
          transportAller:        dto.transportAller ?? null,
          transportSurPlace:     dto.transportSurPlace ?? null,
        },
      });

      return { sejourId: sejour.id };
    });

    // Notifier l'hébergeur
    const centreUser = await this.prisma.user.findFirst({
      where: { centres: { some: { id: dto.centreId } } },
      select: { email: true, prenom: true },
    });
    if (centreUser) {
      const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
      const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
      const lien = `${FRONTEND_URL}/dashboard/sejour/${result.sejourId}`;
      await this.email.sendGenericNotification(
        centreUser.email,
        `Nouvelle demande de séjour — ${dto.titre}`,
        `<p>Un enseignant souhaite organiser un séjour avec votre centre.</p>
         <p><strong>Séjour :</strong> ${dto.titre}<br>
         <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Nombre d'élèves :</strong> ${dto.nombreEleves}</p>
         ${dto.message ? `<p style="padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>` : ''}
         <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à l'espace collaboratif</a></p>`,
      );
    }

    return result;
  }

  async getMesSejours(createurId: string) {
    return this.prisma.sejour.findMany({
      where:   { createurId },
      include: {
        demandes: {
          include: {
            _count: { select: { devis: true } },
            devis: {
              where: { statut: 'SELECTIONNE' },
              select: {
                id: true,
                statut: true,
                montantTotal: true,
                montantTTC: true,
                typeDocument: true,
                estFacture: true,
                numeroFacture: true,
                montantAcompte: true,
                pourcentageAcompte: true,
                centre: { select: { nom: true } },
                // Lot 1 : facture d'acompte liée (le devis ne mute plus vers FACTURE_ACOMPTE)
                factures: {
                  where: { typeFacture: 'ACOMPTE' },
                  select: { numero: true, montantFacture: true, pourcentageAcompte: true },
                  take: 1,
                },
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.sejour.findMany({
      include: {
        createur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getAllSejoursSignataire(signataireId: string, signataireEmail: string) {
    // Source 1 : séjours des organisateurs des mêmes organisations primaires que le signataire
    const memberships = await this.prisma.membership.findMany({
      where: { userId: signataireId, isPrimary: true },
      select: { organisationId: true },
    });
    const orgIds = memberships.map(m => m.organisationId);

    const collegues = orgIds.length > 0
      ? await this.prisma.membership.findMany({
          where: { organisationId: { in: orgIds } },
          select: { userId: true },
        })
      : [];
    const collegueIds = [...new Set(collegues.map(m => m.userId))];

    // Source 2 : séjours pour lesquels le signataire a reçu une invitation directe
    // (InvitationDirecteur n'a pas de FK userId — matching par email destinataire)
    const invitations = await this.prisma.invitationDirecteur.findMany({
      where: { emailDirecteur: signataireEmail },
      select: { sejourId: true },
    });
    const sejourIdsInvitation = invitations.map(i => i.sejourId);

    // Source 3 : séjours DIRECT dont le client est rattaché à une des organisations du signataire
    const sejoursDirect = orgIds.length > 0
      ? await this.prisma.sejour.findMany({
          where: {
            clientOrganisationId: { in: orgIds },
            modeGestion: 'DIRECT',
            deletedAt: null,
          },
          select: { id: true },
        })
      : [];
    const sejourIdsDirectOrg = sejoursDirect.map(s => s.id);

    const orConditions: { createurId?: { in: string[] }; id?: { in: string[] } }[] = [];
    if (collegueIds.length > 0) orConditions.push({ createurId: { in: collegueIds } });
    const allSejourIds = [...new Set([...sejourIdsInvitation, ...sejourIdsDirectOrg])];
    if (allSejourIds.length > 0) orConditions.push({ id: { in: allSejourIds } });

    if (orConditions.length === 0) return [];

    return this.prisma.sejour.findMany({
      where: {
        OR: orConditions,
        deletedAt: null,
      },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true,
            memberships: {
              where: { isPrimary: true },
              select: {
                organisation: { select: { nom: true, ville: true, uai: true } },
              },
              take: 1,
            },
          },
        },
        hebergementSelectionne: { select: { nom: true, ville: true } },
        demandes: {
          include: {
            devis: {
              where: {
                statut: { in: ['EN_ATTENTE_VALIDATION', 'SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'] },
                isComplementaire: false,
              },
              include: {
                lignes: true,
                centre: {
                  select: {
                    id: true, nom: true, ville: true, email: true,
                    telephone: true, adresse: true, codePostal: true,
                    siret: true, tvaIntracommunautaire: true, iban: true,
                    conditionsAnnulation: true, logoUrl: true,
                  },
                },
                demande: {
                  include: {
                    enseignant: {
                      select: { prenom: true, nom: true, email: true, telephone: true },
                    },
                    sejour: {
                      select: {
                        id: true, titre: true, dateDebut: true, dateFin: true,
                        niveauClasse: true, statut: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            },
          },
          take: 1,
        },
        _count: { select: { autorisations: true, planningActivites: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getSejourDetail(id: string, user: { id: string }) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
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
        accompagnateurs: {
          select: {
            id: true, prenom: true, nom: true, email: true,
            telephone: true, signeeAt: true, signatureNom: true,
            moyenTransport: true, createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        autorisations: {
          select: {
            id: true, elevePrenom: true, eleveNom: true,
            parentEmail: true, signeeAt: true,
          },
          orderBy: { eleveNom: 'asc' },
        },
        demandes: {
          include: {
            devis: {
              include: {
                lignes: true,
                centre: { select: { id: true, nom: true, ville: true, email: true, telephone: true } },
              },
            },
          },
        },
        hebergements: { select: { nom: true, adresse: true, ville: true }, take: 1 },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    await assertSignataireCanAccessSejour(this.prisma, user, id);
    const orgaCreateur = sejour.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;
    return { ...sejour, orgaCreateur };
  }

  async getDossierPedagogique(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
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
        hebergementSelectionne: { select: { nom: true, ville: true, adresse: true, telephone: true, imageUrl: true } },
        accompagnateurs: {
          select: {
            id: true, prenom: true, nom: true, email: true,
            telephone: true, signeeAt: true, moyenTransport: true,
            diplome: true,             // TAM Phase 1
            qualificationAutre: true,  // TAM Phase 1
          },
          orderBy: { createdAt: 'asc' },
        },
        planningActivites: {
          orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
        },
        lignesBudget: {
          orderBy: { createdAt: 'asc' as const },
        },
        recettesBudget: {
          orderBy: { createdAt: 'asc' as const },
        },
        demandes: {
          include: {
            devis: {
              where: { statut: 'SELECTIONNE' },
              include: { lignes: true },
              take: 1,
            },
          },
          take: 1,
        },
        autorisations: {
          select: {
            id: true,
            eleveNom: true,
            elevePrenom: true,
            eleveDateNaissance: true,
            parentEmail: true,
            nomParent: true,
            telephoneUrgence: true,
            signeeAt: true,
            moyenPaiement: true,
            paiementValide: true,
          },
          orderBy: { eleveNom: 'asc' },
        },
        _count: { select: { inscriptions: true, autorisations: true } },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');

    // ORGANISATEUR can only see their own
    if (user.role === Role.ORGANISATEUR && sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
    if (user.role === Role.SIGNATAIRE) {
      await assertSignataireCanAccessSejour(this.prisma, user, id);
    }

    const orgaCreateur = sejour.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;
    return { ...sejour, orgaCreateur };
  }

  async soumettreAuRectorat(sejourId: string, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: {
          select: { id: true, prenom: true, nom: true, email: true, telephone: true },
        },
        hebergementSelectionne: {
          select: { nom: true, ville: true, adresse: true, codePostal: true, telephone: true, email: true }
        },
        accompagnateurs: {
          select: { id: true, prenom: true, nom: true, email: true, telephone: true, signeeAt: true, moyenTransport: true, contactUrgenceNom: true, contactUrgenceTel: true },
          orderBy: { createdAt: 'asc' },
        },
        planningActivites: {
          orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
        },
        autorisations: {
          select: {
            eleveNom: true, elevePrenom: true, eleveDateNaissance: true,
            parentEmail: true, nomParent: true, telephoneUrgence: true, signeeAt: true,
          },
          orderBy: { eleveNom: 'asc' },
        },
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.typeContexte === 'HORS_SCOLAIRE') {
      throw new ForbiddenException(
        'Les séjours hors scolaire ne sont pas soumis au rectorat.',
      );
    }
    if (sejour.createurId !== userId || sejour.statut !== 'CONVENTION') {
      throw new ForbiddenException('Accès refusé');
    }

    const orgaCreateur = sejour.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;

    const html = this.genererDossierRectoratHtml(sejour, orgaCreateur);

    const directeur = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailRectorat: true, prenom: true, nom: true },
    });

    await this.prisma.sejour.update({
      where: { id: sejourId },
      data: { statut: StatutSejour.SOUMIS_RECTORAT },
    });

    const destinataire = directeur?.emailRectorat ?? sejour.createur?.email ?? '';
    await this.email.sendDossierRectorat(
      destinataire,
      `${sejour.createur?.prenom ?? ''} ${sejour.createur?.nom ?? ''}`,
      sejour.titre,
      html,
      directeur?.emailRectorat ? sejour.createur?.email : undefined,
    );

    return { message: 'Dossier soumis au rectorat avec succès.' };
  }

  private genererDossierRectoratHtml(sejour: any, orgaCreateur: any): string {
    const fmt = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    const fmtDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const autorisationsSignees = sejour.autorisations.filter((a: any) => a.signeeAt);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Dossier voyage scolaire — ${sejour.titre}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 18px; color: #1B4060; border-bottom: 2px solid #1B4060; padding-bottom: 8px; }
  h2 { font-size: 14px; color: #1B4060; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .header-left { font-size: 11px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1B4060; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .info-block { background: #f5f7fa; border: 1px solid #e0e5ec; border-radius: 6px; padding: 12px; }
  .info-block p { margin: 3px 0; }
  .info-block strong { color: #1B4060; }
  .badge { display: inline-block; background: #1B4060; color: white; border-radius: 4px; padding: 2px 8px; font-size: 10px; }
  .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 10px; color: #999; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <p>République Française — Ministère de l'Éducation Nationale</p>
    <p>Dossier de voyage scolaire — Circulaire du 16 juillet 2024</p>
    <p>Généré le ${fmtDate(new Date().toISOString())} via LIAVO</p>
  </div>
  <div style="text-align:right; font-size:11px; color:#1B4060; font-weight:bold;">
    <p>LIAVO</p>
    <p>Plateforme de coordination des séjours scolaires</p>
  </div>
</div>

<h1>Dossier de voyage scolaire — ${sejour.titre}</h1>

<h2>1. Informations générales du séjour</h2>
<div class="grid">
  <div class="info-block">
    <p><strong>Titre :</strong> ${sejour.titre}</p>
    <p><strong>Lieu :</strong> ${sejour.lieu ?? '—'}</p>
    <p><strong>Dates :</strong> Du ${fmtDate(sejour.dateDebut)} au ${fmtDate(sejour.dateFin)}</p>
    <p><strong>Nombre d'élèves :</strong> ${sejour.placesTotales}</p>
    <p><strong>Niveau :</strong> ${sejour.niveauClasse ?? '—'}</p>
  </div>
  <div class="info-block">
    <p><strong>Établissement :</strong> ${orgaCreateur?.nom ?? '—'}</p>
    <p><strong>UAI :</strong> ${orgaCreateur?.uai ?? '—'}</p>
    <p><strong>Adresse :</strong> ${orgaCreateur?.adresse ?? '—'}</p>
    <p><strong>Ville :</strong> ${orgaCreateur?.ville ?? '—'}</p>
    <p><strong>Tél. établissement :</strong> ${orgaCreateur?.telephoneContact ?? '—'}</p>
  </div>
</div>

<h2>2. Enseignant organisateur</h2>
<div class="info-block">
  <p><strong>Nom :</strong> ${sejour.createur.prenom} ${sejour.createur.nom}</p>
  <p><strong>Email :</strong> ${sejour.createur.email}</p>
  <p><strong>Téléphone :</strong> ${sejour.createur.telephone ?? '—'}</p>
</div>

<h2>3. Hébergement</h2>
<div class="info-block">
  <p><strong>Nom :</strong> ${sejour.hebergementSelectionne?.nom ?? '—'}</p>
  <p><strong>Adresse :</strong> ${sejour.hebergementSelectionne?.adresse ?? '—'}, ${sejour.hebergementSelectionne?.ville ?? '—'}</p>
  <p><strong>Téléphone :</strong> ${sejour.hebergementSelectionne?.telephone ?? '—'}</p>
  <p><strong>Email :</strong> ${sejour.hebergementSelectionne?.email ?? '—'}</p>
</div>

<h2>4. Accompagnateurs (${sejour.accompagnateurs.length})</h2>
<table>
  <thead>
    <tr><th>Nom</th><th>Prénom</th><th>Email</th><th>Téléphone</th><th>Transport</th><th>Contact urgence</th><th>Ordre de mission</th></tr>
  </thead>
  <tbody>
    ${sejour.accompagnateurs.map((a: any) => `<tr><td>${a.nom}</td><td>${a.prenom}</td><td>${a.email}</td><td>${a.telephone ?? '—'}</td><td>${a.moyenTransport ?? '—'}</td><td>${a.contactUrgenceNom ?? '—'} ${a.contactUrgenceTel ? `(${a.contactUrgenceTel})` : ''}</td><td>${a.signeeAt ? '<span class="badge">Signé</span>' : '—'}</td></tr>`).join('')}
  </tbody>
</table>

<h2>5. Liste des élèves participants (${autorisationsSignees.length} autorisations signées / ${sejour.autorisations.length})</h2>
<table>
  <thead>
    <tr><th>Nom</th><th>Prénom</th><th>Date de naissance</th><th>Responsable légal</th><th>Téléphone urgence</th><th>Autorisation</th></tr>
  </thead>
  <tbody>
    ${sejour.autorisations.map((a: any) => `<tr><td>${a.eleveNom}</td><td>${a.elevePrenom}</td><td>${fmt(a.eleveDateNaissance)}</td><td>${a.nomParent ?? '—'}</td><td>${a.telephoneUrgence ?? '—'}</td><td>${a.signeeAt ? '<span class="badge">Signée</span>' : '—'}</td></tr>`).join('')}
  </tbody>
</table>

<h2>6. Programme du séjour</h2>
<table>
  <thead>
    <tr><th>Date</th><th>Heure début</th><th>Heure fin</th><th>Activité</th><th>Responsable</th></tr>
  </thead>
  <tbody>
    ${sejour.planningActivites.length > 0 ? sejour.planningActivites.map((p: any) => `<tr><td>${fmt(p.date)}</td><td>${p.heureDebut}</td><td>${p.heureFin}</td><td>${p.titre}</td><td>${p.responsable ?? '—'}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#999;">Aucune activité planifiée</td></tr>'}
  </tbody>
</table>

<div class="footer">
  <p>Document généré automatiquement par LIAVO — Plateforme de coordination des séjours scolaires</p>
  <p>Référence réglementaire : Circulaire du 16 juillet 2024 relative à l'organisation des sorties et voyages scolaires</p>
</div>

</body>
</html>`;
  }

  async soumettreAuDirecteur(sejourId: string, enseignantId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: {
          select: { id: true, prenom: true, nom: true },
        },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== enseignantId) throw new ForbiddenException('Accès refusé');

    const orgaCreateur = sejour.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;
    if (!orgaCreateur) {
      return { success: false, message: 'Organisation du créateur introuvable.' };
    }

    const directeur = await this.prisma.user.findFirst({
      where: {
        role: 'SIGNATAIRE',
        memberships: { some: { organisationId: orgaCreateur.id, isPrimary: true } },
        compteValide: true,
      },
      select: { email: true, prenom: true, nom: true },
    });

    if (!directeur) {
      return { success: false, message: 'Aucun directeur trouvé pour cet établissement sur Liavo.' };
    }

    const lien = `${FRONTEND_URL}/dashboard/signataire`;
    const dateDebut = sejour.dateDebut ? sejour.dateDebut.toLocaleDateString('fr-FR') : 'À définir';
    const dateFin = sejour.dateFin ? sejour.dateFin.toLocaleDateString('fr-FR') : 'À définir';
    const etablissement = orgaCreateur.nom ?? 'l\'établissement';
    const enseignant = `${sejour.createur?.prenom ?? ''} ${sejour.createur?.nom ?? ''}`.trim();

    await this.email.sendGenericNotification(
      directeur.email,
      `Dossier séjour à examiner — ${sejour.titre}`,
      `<p>Bonjour ${directeur.prenom},</p>
       <p>L'enseignant <strong>${enseignant}</strong> de ${etablissement} vous a transmis le dossier du séjour suivant pour examen :</p>
       <p><strong>Séjour :</strong> ${sejour.titre}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Élèves :</strong> ${sejour.placesTotales}</p>
       <p>Vous pouvez consulter le dossier complet depuis votre tableau de bord.</p>
       <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à mon tableau de bord</a></p>`,
    );

    return { success: true, message: `Dossier transmis à ${directeur.prenom} ${directeur.nom} (${directeur.email})` };
  }

  async inviterDirecteur(sejourId: string, emailDirecteur: string | undefined, devisId: string | undefined, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: {
          select: { id: true, prenom: true },
        },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId) throw new ForbiddenException('Accès refusé');

    // Résoudre l'organisation principale de l'organisateur
    const orgaPrincipale = userId
      ? await getOrganisationPrincipale(userId, this.prisma)
      : null;

    // Cas 1 : directeur déjà inscrit sur LIAVO
    const directeurExistant = orgaPrincipale ? await this.prisma.user.findFirst({
      where: {
        role: 'SIGNATAIRE',
        memberships: { some: { organisationId: orgaPrincipale.id } },
        compteValide: true,
        emailVerifie: true,
      },
      select: { email: true, prenom: true, nom: true },
    }) : null;

    // Changer le statut du devis si fourni
    if (devisId) {
      await this.prisma.devis.update({
        where: { id: devisId },
        data: { statut: 'EN_ATTENTE_VALIDATION' },
      });
    }

    if (directeurExistant) {
      const dateDebut = sejour.dateDebut ? sejour.dateDebut.toLocaleDateString('fr-FR') : 'À définir';
      const dateFin = sejour.dateFin ? sejour.dateFin.toLocaleDateString('fr-FR') : 'À définir';
      const lien = `${FRONTEND_URL}/dashboard/signataire`;
      await this.email.sendGenericNotification(
        directeurExistant.email,
        `Dossier séjour à examiner — ${sejour.titre}`,
        `<p>Bonjour ${directeurExistant.prenom},</p>
         <p>L'enseignant <strong>${sejour.createur?.prenom ?? ''}</strong> vous a transmis un dossier de séjour pour examen :</p>
         <p><strong>Séjour :</strong> ${sejour.titre}<br>
         <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Élèves :</strong> ${sejour.placesTotales}</p>
         <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à mon tableau de bord</a></p>`,
      );
      return { found: true };
    }

    // Cas 2 : directeur non inscrit — besoin d'un email
    if (!emailDirecteur) {
      return { found: false, sent: false, needsEmail: true };
    }

    // Vérifier qu'une invitation récente n'a pas déjà été envoyée (anti-spam 24h)
    const invitationRecente = await this.prisma.invitationDirecteur.findFirst({
      where: {
        emailDirecteur,
        sejourId,
        utilisedAt: null,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (invitationRecente) {
      return { found: false, sent: false, alreadySent: true };
    }

    // Déterminer le typeContexte depuis le séjour
    const typeContexteValue = sejour.typeContexte ?? 'SCOLAIRE';

    const invitation = await this.prisma.invitationDirecteur.create({
      data: {
        sejourId,
        devisId:          devisId ?? null,
        emailDirecteur,
        etablissementUai: orgaPrincipale?.uai ?? null,
        etablissementNom: orgaPrincipale?.nom ?? null,
        enseignantPrenom: sejour.createur?.prenom ?? null,
        sejourTitre:      sejour.titre,
        organisationId:   orgaPrincipale?.id ?? null,
        typeContexte:     typeContexteValue,
      },
    });

    const lienInscription = `${FRONTEND_URL}/register/signataire?token=${invitation.token}`;
    const dateDebut = sejour.dateDebut ? sejour.dateDebut.toLocaleDateString('fr-FR') : 'À définir';
    const dateFin = sejour.dateFin ? sejour.dateFin.toLocaleDateString('fr-FR') : 'À définir';

    await this.email.sendGenericNotification(
      emailDirecteur,
      `${sejour.createur?.prenom ?? 'Un enseignant'} attend votre validation — ${sejour.titre}`,
      `<p>Bonjour,</p>
       <p>Un enseignant de votre établissement (<strong>${orgaPrincipale?.nom ?? ''}</strong>) a organisé un séjour scolaire et souhaite votre validation en tant que directeur(trice) :</p>
       <p><strong>Séjour :</strong> ${sejour.titre}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Élèves :</strong> ${sejour.placesTotales}</p>
       <p>Pour valider ce dossier, créez votre compte directeur sur LIAVO. Votre établissement sera pré-rempli automatiquement.</p>
       <p style="margin:24px 0"><a href="${lienInscription}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Créer mon compte et valider le dossier</a></p>
       <p style="color:#888;font-size:12px">Ce lien est valable 7 jours. Si vous n'êtes pas le(la) directeur(trice) de cet établissement, ignorez cet email.</p>`,
    );

    return { found: false, sent: true };
  }

  async declarerTam(sejourId: string, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }
    if (sejour.typeContexte !== 'HORS_SCOLAIRE') {
      throw new ForbiddenException(
        'Seuls les séjours hors scolaire peuvent être déclarés en TAM.',
      );
    }
    if (sejour.statut !== 'CONVENTION') {
      throw new ForbiddenException(
        'Le séjour doit être en statut Convention pour être déclaré en TAM.',
      );
    }
    return this.prisma.sejour.update({
      where: { id: sejourId },
      data: { statut: 'DECLARE_TAM' },
    });
  }

  async getAccompagnateurs(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    // Return the organisateur (createur) as default accompagnateur
    const createur = await this.prisma.user.findUnique({
      where: { id: sejour.createurId! },
      select: { id: true, prenom: true, nom: true, email: true, telephone: true },
    });

    return { accompagnateurs: createur ? [createur] : [] };
  }

  async updateThematiques(sejourId: string, userId: string, thematiques: string[]) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id: sejourId } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId) throw new ForbiddenException('Accès refusé');

    return this.prisma.sejour.update({
      where: { id: sejourId },
      data: { thematiquesPedagogiques: thematiques },
    });
  }

  async update(id: string, dto: UpdateSejourDto, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: { select: { id: true } },
        demandes: {
          where: { statut: 'OUVERTE' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId) throw new ForbiddenException('Accès refusé');
    if (sejour.statut !== 'DRAFT') throw new ForbiddenException('Ce séjour ne peut plus être modifié');

    const orgaCreateur = sejour.createur?.id
      ? await getOrganisationPrincipale(sejour.createur.id, this.prisma)
      : null;
    const etablissement = orgaCreateur?.nom ?? 'L\'établissement scolaire';

    const updated = await this.prisma.sejour.update({
      where: { id },
      data: {
        ...(dto.prix !== undefined && { prix: dto.prix }),
        ...(dto.dateLimiteInscription !== undefined && { dateLimiteInscription: new Date(dto.dateLimiteInscription) }),
        ...(dto.niveauClasse !== undefined && { niveauClasse: dto.niveauClasse }),
        ...(dto.activitesSouhaitees !== undefined && { activitesSouhaitees: dto.activitesSouhaitees }),
        ...(dto.budgetMaxParEleve !== undefined && { budgetMaxParEleve: dto.budgetMaxParEleve }),
        ...(dto.nombreAccompagnateurs !== undefined && { nombreAccompagnateurs: dto.nombreAccompagnateurs }),
        ...(dto.heureArrivee !== undefined && { heureArrivee: dto.heureArrivee }),
        ...(dto.heureDepart !== undefined && { heureDepart: dto.heureDepart }),
        ...(dto.transportAller !== undefined && { transportAller: dto.transportAller }),
        ...(dto.transportSurPlace !== undefined && { transportSurPlace: dto.transportSurPlace }),
        ...(dto.informationsComplementaires !== undefined && { description: dto.informationsComplementaires }),
      },
    });

    // Mettre à jour la DemandeDevis OUVERTE si elle existe
    const demandeOuverte = sejour.demandes?.[0];
    if (demandeOuverte) {
      await this.prisma.demandeDevis.update({
        where: { id: demandeOuverte.id },
        data: {
          ...(dto.activitesSouhaitees !== undefined && { activitesSouhaitees: dto.activitesSouhaitees }),
          ...(dto.budgetMaxParEleve !== undefined && { budgetMaxParEleve: dto.budgetMaxParEleve }),
          ...(dto.nombreAccompagnateurs !== undefined && { nombreAccompagnateurs: dto.nombreAccompagnateurs }),
          ...(dto.heureArrivee !== undefined && { heureArrivee: dto.heureArrivee }),
          ...(dto.heureDepart !== undefined && { heureDepart: dto.heureDepart }),
          ...(dto.transportAller !== undefined && { transportAller: dto.transportAller }),
          ...(dto.transportSurPlace !== undefined && { transportSurPlace: dto.transportSurPlace }),
        },
      });
    }

    // Envoyer un email aux parents quand le prix est défini
    if (dto.prix !== undefined && dto.prix > 0) {
      const autorisations = await this.prisma.autorisationParentale.findMany({
        where: { sejourId: id },
        select: { parentEmail: true, elevePrenom: true, eleveNom: true, tokenAcces: true },
      });

      const prixFormate = dto.prix.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

      for (const aut of autorisations) {
        // Mode saisie directe : pas de parentEmail → pas d'email de paiement
        if (!aut.parentEmail) continue;
        const lien = `${FRONTEND_URL}/autorisation/${aut.tokenAcces}`;
        await this.email.sendPaiementDisponible(
          aut.parentEmail,
          sejour.titre,
          etablissement,
          prixFormate,
          aut.elevePrenom,
          aut.eleveNom,
          lien,
        );
      }
    }

    return updated;
  }

  async updateStatus(id: string, statut: StatutSejour, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');

    if (user.role === Role.ORGANISATEUR) {
      if (sejour.createurId !== user.id)
        throw new ForbiddenException('Ce séjour ne vous appartient pas');
      if (statut !== StatutSejour.SUBMITTED)
        throw new ForbiddenException('Les enseignants peuvent uniquement soumettre un séjour');
    }

    if (user.role === Role.SIGNATAIRE || user.role === Role.AUTORITE) {
      await assertSignataireCanAccessSejour(this.prisma, user, id);
    }

    const updated = await this.prisma.sejour.update({
      where: { id },
      data:  { statut },
    });

    // Auto-create DemandeDevis when a sejour is SUBMITTED
    if (statut === StatutSejour.SUBMITTED && sejour.createurId) {
      // Une DemandeDevis (appel d'offre) exige des dates OU une période souhaitée.
      const hasDateInfo = (sejour.dateDebut && sejour.dateFin) || sejour.moisSouhaite || sejour.noteDateFlexible;
      if (!hasDateInfo) {
        throw new BadRequestException(
          'Renseignez des dates ou une période souhaitée avant de soumettre',
        );
      }
      const thematiques = sejour.thematiquesPedagogiques ?? [];
      const descParts = [
        sejour.description ?? '',
        sejour.niveauClasse ? `Niveau : ${sejour.niveauClasse}` : '',
        thematiques.length > 0 ? `Thématiques : ${thematiques.join(', ')}` : '',
      ].filter(Boolean);

      await this.prisma.demandeDevis.create({
        data: {
          sejourId:           sejour.id,
          titre:              sejour.titre,
          description:        descParts.join('\n'),
          dateDebut:          sejour.dateDebut,
          dateFin:            sejour.dateFin,
          moisSouhaite:       sejour.moisSouhaite ?? null,
          anneeSouhaitee:     sejour.anneeSouhaitee ?? null,
          noteDateFlexible:   sejour.noteDateFlexible ?? null,
          dureeNuits:         sejour.dureeNuits ?? null,
          nombreEleves:       sejour.placesTotales,
          villeHebergement:   sejour.lieu,
          regionCible:        sejour.regionSouhaitee ?? '',
          typePension:        [],
          dateButoireReponse: sejour.dateButoireDevis,
          nombreAccompagnateurs: sejour.nombreAccompagnateurs ?? null,
          heureArrivee:          sejour.heureArrivee ?? null,
          heureDepart:           sejour.heureDepart ?? null,
          activitesSouhaitees:   sejour.activitesSouhaitees ?? null,
          budgetMaxParEleve:     sejour.budgetMaxParEleve ?? null,
          transportAller:        sejour.transportAller ?? null,
          transportSurPlace:     sejour.transportSurPlace ?? null,
          enseignantId:       sejour.createurId,
        },
      });

      await this.prisma.sejour.update({
        where: { id },
        data:  { appelOffreStatut: AppelOffreStatut.OUVERT },
      });

      // Notifier les hébergeurs de la nouvelle demande
      const periodeLabel = buildPeriodeLabel({
        dateDebut: sejour.dateDebut?.toISOString(),
        dateFin: sejour.dateFin?.toISOString(),
        moisSouhaite: sejour.moisSouhaite ?? undefined,
        anneeSouhaitee: sejour.anneeSouhaitee ?? undefined,
        noteDateFlexible: sejour.noteDateFlexible ?? undefined,
        dureeNuits: sejour.dureeNuits ?? undefined,
      });
      // TODO: ABONNEMENT — réactiver le filtre par abonnement actif
      const centres = await this.prisma.centreHebergement.findMany({
        include: { user: { select: { email: true } } },
      });

      // Filtre géographique (même logique que demande.service.ts matchesZone)
      const regionCible = sejour.regionSouhaitee ?? '';
      const centresFiltres = regionCible
        ? centres.filter(c => {
            if (!c.codePostal) return true;
            const colonIdx = regionCible.indexOf(':');
            if (colonIdx === -1) return true;
            const type = regionCible.substring(0, colonIdx);
            const value = regionCible.substring(colonIdx + 1);
            const dept = c.codePostal.startsWith('97')
              ? c.codePostal.substring(0, 3)
              : c.codePostal.startsWith('20') ? '20' : c.codePostal.substring(0, 2);
            const DEPT_REGION: Record<string, string> = {
              '01':'Auvergne-Rhône-Alpes','03':'Auvergne-Rhône-Alpes','07':'Auvergne-Rhône-Alpes',
              '15':'Auvergne-Rhône-Alpes','26':'Auvergne-Rhône-Alpes','38':'Auvergne-Rhône-Alpes',
              '42':'Auvergne-Rhône-Alpes','43':'Auvergne-Rhône-Alpes','63':'Auvergne-Rhône-Alpes',
              '69':'Auvergne-Rhône-Alpes','73':'Auvergne-Rhône-Alpes','74':'Auvergne-Rhône-Alpes',
              '21':'Bourgogne-Franche-Comté','25':'Bourgogne-Franche-Comté','39':'Bourgogne-Franche-Comté',
              '58':'Bourgogne-Franche-Comté','70':'Bourgogne-Franche-Comté','71':'Bourgogne-Franche-Comté',
              '89':'Bourgogne-Franche-Comté','90':'Bourgogne-Franche-Comté',
              '22':'Bretagne','29':'Bretagne','35':'Bretagne','56':'Bretagne',
              '18':'Centre-Val de Loire','28':'Centre-Val de Loire','36':'Centre-Val de Loire',
              '37':'Centre-Val de Loire','41':'Centre-Val de Loire','45':'Centre-Val de Loire',
              '20':'Corse',
              '08':'Grand Est','10':'Grand Est','51':'Grand Est','52':'Grand Est',
              '54':'Grand Est','55':'Grand Est','57':'Grand Est','67':'Grand Est',
              '68':'Grand Est','88':'Grand Est',
              '02':'Hauts-de-France','59':'Hauts-de-France','60':'Hauts-de-France',
              '62':'Hauts-de-France','80':'Hauts-de-France',
              '75':'Île-de-France','77':'Île-de-France','78':'Île-de-France',
              '91':'Île-de-France','92':'Île-de-France','93':'Île-de-France',
              '94':'Île-de-France','95':'Île-de-France',
              '14':'Normandie','27':'Normandie','50':'Normandie','61':'Normandie','76':'Normandie',
              '16':'Nouvelle-Aquitaine','17':'Nouvelle-Aquitaine','19':'Nouvelle-Aquitaine',
              '23':'Nouvelle-Aquitaine','24':'Nouvelle-Aquitaine','33':'Nouvelle-Aquitaine',
              '40':'Nouvelle-Aquitaine','47':'Nouvelle-Aquitaine','64':'Nouvelle-Aquitaine',
              '79':'Nouvelle-Aquitaine','86':'Nouvelle-Aquitaine','87':'Nouvelle-Aquitaine',
              '09':'Occitanie','11':'Occitanie','12':'Occitanie','30':'Occitanie',
              '31':'Occitanie','32':'Occitanie','34':'Occitanie','46':'Occitanie',
              '48':'Occitanie','65':'Occitanie','66':'Occitanie','81':'Occitanie','82':'Occitanie',
              '44':'Pays de la Loire','49':'Pays de la Loire','53':'Pays de la Loire',
              '72':'Pays de la Loire','85':'Pays de la Loire',
              '04':"Provence-Alpes-Côte d'Azur",'05':"Provence-Alpes-Côte d'Azur",
              '06':"Provence-Alpes-Côte d'Azur",'13':"Provence-Alpes-Côte d'Azur",
              '83':"Provence-Alpes-Côte d'Azur",'84':"Provence-Alpes-Côte d'Azur",
            };
            if (type === 'FRANCE') return true;
            if (type === 'REGION') return DEPT_REGION[dept] === value;
            if (type === 'DEPARTEMENT') return dept === value.split(' - ')[0];
            if (type === 'VILLE') {
              const villeName = value.split(' (')[0].toLowerCase();
              return (c.ville ?? '').toLowerCase().includes(villeName);
            }
            return true;
          })
        : centres;

      for (const centre of centresFiltres) {
        if (!centre.user?.email) continue;
        await this.email.sendNouvelleDemandeDevis(
          centre.user.email,
          centre.nom,
          sejour.titre,
          sejour.lieu ?? '',
          periodeLabel,
        );
      }

      // Le séjour reste en SUBMITTED — le directeur validera via signerDevis
    }

    return updated;
  }

  // ── Séjour DIRECT (gestion hébergeur sans compte organisateur) ────────────

  async createDirect(
    dto: CreateSejourDirectDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    if (!['SEJOUR', 'EVENEMENT'].includes(dto.natureSejour)) {
      throw new ForbiddenException('natureSejour doit être SEJOUR ou EVENEMENT');
    }

    const sejour = await this.prisma.sejour.create({
      data: {
        titre: dto.titre,
        description: dto.description ?? null,
        lieu: centre.ville,
        // Dates optionnelles : un séjour « Dates à définir » est créé sans dateDebut/dateFin
        // (Prisma insère null pour les champs optionnels non fournis).
        ...(dto.dateDebut ? { dateDebut: new Date(dto.dateDebut) } : {}),
        ...(dto.dateFin ? { dateFin: new Date(dto.dateFin) } : {}),
        ...(dto.moisSouhaite ? { moisSouhaite: dto.moisSouhaite } : {}),
        ...(dto.anneeSouhaitee ? { anneeSouhaitee: dto.anneeSouhaitee } : {}),
        ...(dto.noteDateFlexible ? { noteDateFlexible: dto.noteDateFlexible } : {}),
        ...(dto.dureeNuits ? { dureeNuits: dto.dureeNuits } : {}),
        placesTotales: dto.nombreParticipants,
        placesRestantes: dto.nombreParticipants,
        statut: 'OPTION',
        modeGestion: 'DIRECT',
        natureSejour: dto.natureSejour,
        typeSejour: dto.typeSejour ?? null,
        createurId: null,
        hebergementSelectionneId: centre.id,
        clientNom: dto.clientNom ?? null,
        clientPrenom: dto.clientPrenom ?? null,
        clientEmail: dto.clientEmail ?? null,
        clientTelephone: dto.clientTelephone ?? null,
        clientOrganisation: dto.clientOrganisation ?? null,
        clientOrganisationId: dto.clientOrganisationId ?? null,
        clientAdresse: dto.clientAdresse ?? null,
        clientCodePostal: dto.clientCodePostal ?? null,
        clientVille: dto.clientVille ?? null,
      },
    });

    if (dto.clientId) {
      // Client CRM existant : liaison directe, pas de recherche/création (évite un client fantôme).
      try {
        await this.prisma.sejourClient.upsert({
          where: { clientId_sejourId: { clientId: dto.clientId, sejourId: sejour.id } },
          create: { clientId: dto.clientId, sejourId: sejour.id },
          update: {},
        });
      } catch (err) {
        console.error('[SEJOUR_DIRECT] Erreur liaison client existant:', err);
      }
    } else if (dto.clientEmail || dto.clientNom) {
      try {
        await this.linkSejourToClient(sejour, centre.id);
      } catch (err) {
        console.error('[SEJOUR_DIRECT] Erreur liaison CRM:', err);
      }
    }

    return sejour;
  }

  /**
   * Lie un séjour DIRECT à un Client CRM.
   * Cherche par email+centreId, puis par organisationId+centreId, sinon crée le client.
   */
  private async linkSejourToClient(
    sejour: {
      id: string;
      clientEmail: string | null;
      clientNom: string | null;
      clientOrganisation: string | null;
      clientOrganisationId: string | null;
      clientTelephone: string | null;
      clientAdresse: string | null;
      clientCodePostal: string | null;
      clientVille: string | null;
      titre: string;
      dateDebut: Date | null;
      dateFin: Date | null;
    },
    centreId: string,
  ) {
    let client: { id: string } | null = null;

    if (sejour.clientEmail) {
      client = await this.prisma.client.findFirst({
        where: { centreId, email: sejour.clientEmail },
        select: { id: true },
      });
    }

    if (!client && sejour.clientOrganisationId) {
      client = await this.prisma.client.findFirst({
        where: { centreId, organisationId: sejour.clientOrganisationId },
        select: { id: true },
      });
    }

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          centreId,
          nom: sejour.clientOrganisation || sejour.clientNom || 'Client inconnu',
          email: sejour.clientEmail ?? undefined,
          telephone: sejour.clientTelephone ?? undefined,
          adresse: sejour.clientAdresse ?? undefined,
          codePostal: sejour.clientCodePostal ?? undefined,
          ville: sejour.clientVille ?? undefined,
          type: 'ETABLISSEMENT_SCOLAIRE',
          statut: 'EN_NEGOCIATION',
          organisationId: sejour.clientOrganisationId ?? undefined,
        },
      });
    }

    await this.prisma.sejourClient.upsert({
      where: {
        clientId_sejourId: { clientId: client.id, sejourId: sejour.id },
      },
      update: {},
      create: { clientId: client.id, sejourId: sejour.id },
    });

    const fmtDate = (d: Date | null) =>
      d
        ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'dates à définir';
    const periode =
      sejour.dateDebut || sejour.dateFin
        ? `${fmtDate(sejour.dateDebut)} → ${fmtDate(sejour.dateFin)}`
        : 'dates à définir';
    await this.prisma.activiteClient.create({
      data: {
        clientId: client.id,
        centreId,
        type: 'NOTE',
        description: `Séjour "${sejour.titre}" créé — ${periode}`,
        metadata: { sejourId: sejour.id },
      },
    });
  }

  async softDeleteSejour(sejourId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true,
        hebergementSelectionneId: true,
        modeGestion: true,
        titre: true,
        deletedAt: true,
        clientEmail: true,
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.deletedAt) throw new NotFoundException('Séjour déjà supprimé');
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    // Devis liés au séjour (DIRECT via sejourDirectId, COLLABORATIF via demande.sejourId).
    const devisSejourWhere: Prisma.DevisWhereInput = {
      OR: [
        { sejourDirectId: sejourId },
        { demande: { sejourId } },
      ],
    };

    // Garde 1 : factures émises (acompte / solde / avoir) → conservation 10 ans
    // (obligation comptable FR). Le séjour reste en base comme dossier archivé,
    // même si les devis ont été annulés via avoir.
    const facturesCount = await this.prisma.facture.count({
      where: { devis: devisSejourWhere },
    });
    if (facturesCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer ce séjour — des factures ont été émises et doivent être conservées (obligation comptable). Ce dossier reste archivé.',
      );
    }

    // Garde 2 : devis signé encore actif (non annulé) → l'hébergeur doit l'annuler
    // d'abord (passage en NON_RETENU). Le devis ne mute pas en FACTURE_* : un devis
    // facturé reste SELECTIONNE/SIGNE_DIRECTION (déjà bloqué par la garde 1 si facturé).
    const devisEngageant = await this.prisma.devis.count({
      where: {
        ...devisSejourWhere,
        statut: { in: [StatutDevis.SELECTIONNE, StatutDevis.SIGNE_DIRECTION] },
      },
    });
    if (devisEngageant > 0) {
      throw new BadRequestException(
        'Impossible de supprimer ce séjour — il contient des devis signés. Annulez les devis d\'abord.',
      );
    }

    // Suppression en cascade des devis restants (brouillon EN_ATTENTE, EN_ATTENTE_VALIDATION,
    // NON_RETENU, etc.) — aucun n'a de facture grâce à la garde 1. lignes_devis et
    // versements suivent (onDelete: Cascade). Évite les devis orphelins après suppression.
    await this.prisma.$transaction([
      this.prisma.devis.deleteMany({ where: devisSejourWhere }),
      this.prisma.sejour.update({
        where: { id: sejourId },
        data: { deletedAt: new Date() },
      }),
    ]);

    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: centre.id,
            type: 'NOTE',
            description: `Séjour "${sejour.titre}" annulé`,
            metadata: { sejourId },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { deleted: true };
  }

  /**
   * Envoie une invitation à un organisateur pour collaborer sur un séjour DIRECT.
   * À l'acceptation, modeGestion passe DIRECT → COLLABORATIF, createurId est set.
   */
  async inviterOrganisateur(
    sejourId: string,
    emailOrganisateur: string,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true, titre: true, dateDebut: true, dateFin: true, placesTotales: true,
        nombreAccompagnateurs: true,
        modeGestion: true, hebergementSelectionneId: true, deletedAt: true,
        clientNom: true, clientOrganisation: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Ce séjour n\'est pas en gestion directe');
    }
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }
    // Une InvitationCollaboration exige des dates : on ne peut pas passer en mode
    // collaboratif un séjour « Dates à définir ».
    if (!sejour.dateDebut || !sejour.dateFin) {
      throw new BadRequestException(
        'Les dates doivent être définies avant de passer en mode collaboratif',
      );
    }

    // Anti-spam : si une invitation est déjà en attente pour ce séjour, on la
    // réutilise (le token/lien reste valide) en mettant l'email à jour, plutôt que
    // d'en créer une nouvelle à chaque envoi. Sinon on en crée une.
    const pending = await this.prisma.invitationCollaboration.findFirst({
      where: { sejourId: sejour.id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const invitation = pending
      ? await this.prisma.invitationCollaboration.update({
          where: { id: pending.id },
          data: { emailEnseignant: emailOrganisateur.trim() },
        })
      : await this.prisma.invitationCollaboration.create({
          data: {
            centreId: centre.id,
            emailEnseignant: emailOrganisateur.trim(),
            titreSejourSuggere: sejour.titre,
            dateDebut: sejour.dateDebut,
            dateFin: sejour.dateFin,
            nbElevesEstime: sejour.placesTotales,
            message: `${centre.nom} vous invite à collaborer sur le séjour "${sejour.titre}".`,
            sejourId: sejour.id,
          },
        });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const lien = `${frontendUrl}/rejoindre/${invitation.token}`;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    await this.email.sendGenericNotification(
      emailOrganisateur.trim(),
      `${centre.nom} vous invite à collaborer sur un séjour`,
      `<p>Bonjour,</p>
       <p><strong>${centre.nom}</strong> vous invite à rejoindre l'espace collaboratif pour le séjour :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.titre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Participants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${formatParticipants(sejour.placesTotales, sejour.nombreAccompagnateurs)}</td></tr>
       </table>
       <p>En rejoignant, vous aurez accès à l'espace collaboratif : messagerie, documents partagés, planning, journal de séjour.</p>
       <p style="margin:24px 0">
         <a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Rejoindre le séjour
         </a>
       </p>`,
      centre.nom,
    );

    return { success: true, message: 'Invitation envoyée' };
  }
}
