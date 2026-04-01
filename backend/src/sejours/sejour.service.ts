import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, StatutSejour, AppelOffreStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import { UpdateSejourDto } from './dto/update-sejour.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

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
        dateDebut:                new Date(dto.dateDebut),
        dateFin:                  new Date(dto.dateFin),
        placesTotales:            dto.nombreEleves,
        placesRestantes:          dto.nombreEleves,
        niveauClasse:             dto.niveauClasse,
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

  async findByEtablissement(etablissementUai: string) {
    return this.prisma.sejour.findMany({
      where: {
        createur: {
          etablissementUai: etablissementUai,
        },
      },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true,
            etablissementNom: true, etablissementUai: true,
          },
        },
        hebergementSelectionne: {
          select: { nom: true, ville: true },
        },
        demandes: {
          include: {
            devis: {
              where: {
                statut: { in: ['EN_ATTENTE_VALIDATION', 'SELECTIONNE'] },
                typeDocument: 'DEVIS',
              },
              include: {
                lignes: true,
                centre: {
                  select: {
                    id: true, nom: true, ville: true, email: true,
                    telephone: true, adresse: true, codePostal: true,
                    siret: true, tvaIntracommunautaire: true, iban: true,
                    conditionsAnnulation: true,
                  },
                },
                demande: {
                  include: {
                    enseignant: {
                      select: {
                        prenom: true, nom: true, email: true, telephone: true,
                        etablissementNom: true, etablissementAdresse: true,
                        etablissementVille: true, etablissementUai: true,
                        etablissementEmail: true, etablissementTelephone: true,
                      },
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
        _count: {
          select: { autorisations: true, planningActivites: true },
        },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async getSejourDetail(id: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementUai: true,
            etablissementEmail: true, etablissementTelephone: true,
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
    return sejour;
  }

  async getDossierPedagogique(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementUai: true,
            etablissementEmail: true, etablissementTelephone: true,
          },
        },
        hebergementSelectionne: { select: { nom: true, ville: true, adresse: true, telephone: true, imageUrl: true } },
        accompagnateurs: {
          select: {
            id: true, prenom: true, nom: true, email: true,
            telephone: true, signeeAt: true, moyenTransport: true,
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

    // TEACHER can only see their own
    if (user.role === Role.TEACHER && sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return sejour;
  }

  async soumettreAuRectorat(sejourId: string, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementUai: true,
            etablissementEmail: true, etablissementTelephone: true,
          },
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
    if (sejour.createurId !== userId && sejour.statut !== 'CONVENTION') {
      throw new ForbiddenException('Accès refusé');
    }

    const html = this.genererDossierRectoratHtml(sejour);

    const directeur = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailRectorat: true, prenom: true, nom: true },
    });

    await this.prisma.sejour.update({
      where: { id: sejourId },
      data: { statut: 'SOUMIS_RECTORAT' as any },
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

  private genererDossierRectoratHtml(sejour: any): string {
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
    <p><strong>Établissement :</strong> ${sejour.createur.etablissementNom ?? '—'}</p>
    <p><strong>UAI :</strong> ${sejour.createur.etablissementUai ?? '—'}</p>
    <p><strong>Adresse :</strong> ${sejour.createur.etablissementAdresse ?? '—'}</p>
    <p><strong>Ville :</strong> ${sejour.createur.etablissementVille ?? '—'}</p>
    <p><strong>Tél. établissement :</strong> ${sejour.createur.etablissementTelephone ?? '—'}</p>
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
          select: {
            prenom: true, nom: true,
            etablissementNom: true, etablissementUai: true,
          },
        },
      },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== enseignantId) throw new ForbiddenException('Accès refusé');

    const directeur = await this.prisma.user.findFirst({
      where: {
        role: 'DIRECTOR',
        etablissementUai: sejour.createur?.etablissementUai ?? undefined,
        compteValide: true,
      },
      select: { email: true, prenom: true, nom: true },
    });

    if (!directeur) {
      return { success: false, message: 'Aucun directeur trouvé pour cet établissement sur Liavo.' };
    }

    const lien = `${FRONTEND_URL}/dashboard/director`;
    const dateDebut = sejour.dateDebut.toLocaleDateString('fr-FR');
    const dateFin = sejour.dateFin.toLocaleDateString('fr-FR');
    const etablissement = sejour.createur?.etablissementNom ?? 'l\'établissement';
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

  async getAccompagnateurs(id: string, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    // Return the teacher (createur) as default accompagnateur
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
      include: { createur: { select: { etablissementNom: true } } },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== userId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const data: Record<string, unknown> = {};
    if (dto.prix !== undefined) data.prix = dto.prix;
    if (dto.dateLimiteInscription !== undefined)
      data.dateLimiteInscription = new Date(dto.dateLimiteInscription);

    const updated = await this.prisma.sejour.update({ where: { id }, data });

    // Envoyer un email aux parents quand le prix est défini
    if (dto.prix !== undefined && dto.prix > 0) {
      const autorisations = await this.prisma.autorisationParentale.findMany({
        where: { sejourId: id },
        select: { parentEmail: true, elevePrenom: true, eleveNom: true, tokenAcces: true },
      });

      const etablissement = sejour.createur?.etablissementNom ?? 'L\'établissement scolaire';
      const prixFormate = dto.prix.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

      for (const aut of autorisations) {
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

    if (user.role === Role.TEACHER) {
      if (sejour.createurId !== user.id)
        throw new ForbiddenException('Ce séjour ne vous appartient pas');
      if (statut !== StatutSejour.SUBMITTED)
        throw new ForbiddenException('Les enseignants peuvent uniquement soumettre un séjour');
    }

    const updated = await this.prisma.sejour.update({
      where: { id },
      data:  { statut },
    });

    // Notifier l'enseignant quand le séjour est approuvé
    if (statut === StatutSejour.APPROVED && sejour.createurId) {
      const enseignant = await this.prisma.user.findUnique({
        where: { id: sejour.createurId },
        select: { email: true, prenom: true, nom: true },
      });
      if (enseignant) {
        await this.email.sendSejourApprouve(
          enseignant.email,
          `${enseignant.prenom} ${enseignant.nom}`,
          sejour.titre,
        );
      }

      // Notifier l'hébergeur si un centre est sélectionné
      if (sejour.hebergementSelectionneId) {
        const centreSelectionne = await this.prisma.centreHebergement.findUnique({
          where: { id: sejour.hebergementSelectionneId },
          include: { user: { select: { email: true } } },
        });
        if (centreSelectionne?.user?.email) {
          const dateDebut = sejour.dateDebut.toLocaleDateString('fr-FR');
          const dateFin = sejour.dateFin.toLocaleDateString('fr-FR');
          const lien = `${FRONTEND_URL}/dashboard/venue`;
          await this.email.sendGenericNotification(
            centreSelectionne.user.email,
            `Séjour approuvé par la direction — ${sejour.titre}`,
            `<p>Bonne nouvelle ! Le directeur de l'établissement a approuvé le séjour suivant :</p>
             <p><strong>Séjour :</strong> ${sejour.titre}<br>
             <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
             <strong>Élèves :</strong> ${sejour.placesTotales}</p>
             <p>Vous pouvez consulter les détails depuis votre tableau de bord.</p>
             <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à mon tableau de bord</a></p>`,
          );
        }
      }
    }

    // Auto-create DemandeDevis when a sejour is SUBMITTED
    if (statut === StatutSejour.SUBMITTED && sejour.createurId) {
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
          nombreEleves:       sejour.placesTotales,
          villeHebergement:   sejour.lieu,
          regionCible:        sejour.regionSouhaitee ?? '',
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
      const dateDebut = sejour.dateDebut.toLocaleDateString('fr-FR');
      const dateFin = sejour.dateFin.toLocaleDateString('fr-FR');
      // TODO: ABONNEMENT — réactiver le filtre par abonnement actif
      const centres = await this.prisma.centreHebergement.findMany({
        include: { user: { select: { email: true } } },
      });
      for (const centre of centres) {
        if (!centre.user?.email) continue;
        await this.email.sendNouvelleDemandeDevis(
          centre.user.email,
          centre.nom,
          sejour.titre,
          sejour.lieu ?? '',
          dateDebut,
          dateFin,
        );
      }

      // Le séjour reste en SUBMITTED — le directeur validera via signerDevis
    }

    return updated;
  }
}
