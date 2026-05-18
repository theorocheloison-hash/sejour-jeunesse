import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { StatutDevis } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { CreateRappelDto } from './dto/create-rappel.dto.js';

const INCLUDE_FULL = {
  contacts: true,
  rappels: { orderBy: { dateEcheance: 'asc' as const } },
  sejours: {
    include: {
      client: false,
    },
  },
};

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService, private email: EmailService) {}

  private async getCentreId(userId: string): Promise<string> {
    const centre = await this.prisma.centreHebergement.findFirst({ where: { userId } });
    if (!centre) throw new ForbiddenException('Centre introuvable');
    return centre.id;
  }

  async getRappelsToday(userId: string) {
    const centreId = await this.getCentreId(userId);
    const debutAujourdhui = new Date();
    debutAujourdhui.setHours(0, 0, 0, 0);
    const finAujourdhui = new Date();
    finAujourdhui.setHours(23, 59, 59, 999);

    return this.prisma.rappel.findMany({
      where: {
        client: { centreId },
        dateEcheance: { gte: debutAujourdhui, lte: finAujourdhui },
        statut: 'A_FAIRE',
      },
      include: {
        client: { select: { id: true, nom: true } },
      },
      orderBy: { dateEcheance: 'asc' },
    });
  }

  async getMesClients(userId: string) {
    const centreId = await this.getCentreId(userId);

    const clients = await this.prisma.client.findMany({
      where: { centreId },
      include: {
        contacts: true,
        rappels: { orderBy: { dateEcheance: 'asc' } },
        sejours: true,
      },
      orderBy: { nom: 'asc' },
    });

    const sejourIds = clients.flatMap(c => c.sejours.map(s => s.sejourId));
    if (sejourIds.length === 0) {
      return clients.map(c => ({ ...c, devis: [], montantCA: 0, nombreSejours: c.sejours.length }));
    }

    const devis = await this.prisma.devis.findMany({
      where: {
        centreId,
        demande: { sejourId: { in: sejourIds } },
        statut: {
          in: [StatutDevis.SELECTIONNE, StatutDevis.SIGNE_DIRECTION],
        },
      },
      select: {
        id: true,
        numeroDevis: true,
        numeroFacture: true,
        typeDocument: true,
        statut: true,
        montantTotal: true,
        montantTTC: true,
        montantAcompte: true,
        acompteVerse: true,
        dateFacture: true,
        createdAt: true,
        demande: {
          select: {
            sejourId: true,
            sejour: { select: { titre: true, dateDebut: true, dateFin: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const devisBySejourId = new Map<string, typeof devis>();
    for (const d of devis) {
      const sid = d.demande?.sejourId;
      if (!sid) continue;
      if (!devisBySejourId.has(sid)) devisBySejourId.set(sid, []);
      devisBySejourId.get(sid)!.push(d);
    }

    return clients.map(c => {
      const devisClient = c.sejours.flatMap(s => devisBySejourId.get(s.sejourId) ?? []);
      const montantCA = devisClient.reduce(
        (sum, d) => sum + (d.montantTTC ?? Number(d.montantTotal) ?? 0),
        0,
      );
      return {
        ...c,
        devis: devisClient,
        montantCA,
        nombreSejours: c.sejours.length,
      };
    });
  }

  async getClient(id: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { contacts: true, rappels: { orderBy: { dateEcheance: 'asc' } }, sejours: true },
    });
    if (!client) throw new NotFoundException();
    if (client.centreId !== centreId) throw new ForbiddenException();
    return client;
  }

  async createClient(dto: CreateClientDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    if (dto.uai) {
      const existing = await this.prisma.client.findFirst({ where: { centreId, uai: dto.uai } });
      if (existing) return existing;
    }
    return this.prisma.client.create({
      data: { ...dto, centreId, source: dto.source ?? 'MANUEL' },
      include: { contacts: true, rappels: true, sejours: true },
    });
  }

  async updateClient(id: string, dto: Partial<CreateClientDto>, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.client.update({ where: { id }, data: dto, include: { contacts: true, rappels: true, sejours: true } });
  }

  async deleteClient(id: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.client.delete({ where: { id } });
  }

  async addContact(clientId: string, dto: CreateContactDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();

    // Récupère la RelationCommerciale si elle existe (pont legacy)
    let relationId: string | undefined;
    try {
      const centre = await this.prisma.centreHebergement.findFirst({
        where: { userId },
        select: { organisationId: true },
      });
      if (client.organisationId && centre?.organisationId) {
        const rel = await this.prisma.relationCommerciale.findUnique({
          where: {
            organisationHebergeurId_organisationClienteId: {
              organisationHebergeurId: centre.organisationId,
              organisationClienteId: client.organisationId,
            },
          },
          select: { id: true },
        });
        relationId = rel?.id;
      }
    } catch { /* non bloquant */ }

    return this.prisma.contactClient.create({ data: { ...dto, clientId, relationId: relationId ?? undefined } });
  }

  async updateContact(contactId: string, dto: Partial<CreateContactDto>, userId: string) {
    const centreId = await this.getCentreId(userId);
    const contact = await this.prisma.contactClient.findUnique({ where: { id: contactId }, include: { client: true } });
    if (!contact || contact.client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.contactClient.update({ where: { id: contactId }, data: dto });
  }

  async deleteContact(contactId: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const contact = await this.prisma.contactClient.findUnique({ where: { id: contactId }, include: { client: true } });
    if (!contact || contact.client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.contactClient.delete({ where: { id: contactId } });
  }

  async addRappel(clientId: string, dto: CreateRappelDto, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();

    // Récupère la RelationCommerciale si elle existe (pont legacy)
    let relationId: string | undefined;
    try {
      const centre = await this.prisma.centreHebergement.findFirst({
        where: { userId },
        select: { organisationId: true },
      });
      if (client.organisationId && centre?.organisationId) {
        const rel = await this.prisma.relationCommerciale.findUnique({
          where: {
            organisationHebergeurId_organisationClienteId: {
              organisationHebergeurId: centre.organisationId,
              organisationClienteId: client.organisationId,
            },
          },
          select: { id: true },
        });
        relationId = rel?.id;
      }
    } catch { /* non bloquant */ }

    return this.prisma.rappel.create({
      data: {
        clientId,
        type: dto.type,
        dateEcheance: new Date(dto.dateEcheance),
        description: dto.description,
        statut: dto.statut ?? 'A_FAIRE',
        relationId: relationId ?? undefined,
      },
    });
  }

  async updateRappelStatut(rappelId: string, statut: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const rappel = await this.prisma.rappel.findUnique({ where: { id: rappelId }, include: { client: true } });
    if (!rappel || rappel.client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.rappel.update({ where: { id: rappelId }, data: { statut } });
  }

  async deleteRappel(rappelId: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const rappel = await this.prisma.rappel.findUnique({ where: { id: rappelId }, include: { client: true } });
    if (!rappel || rappel.client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.rappel.delete({ where: { id: rappelId } });
  }

  async rattacherSejour(clientId: string, sejourId: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.sejourClient.upsert({
      where: { clientId_sejourId: { clientId, sejourId } },
      create: { clientId, sejourId },
      update: {},
    });
  }

  async autoRattacherDepuisDevis(sejourId: string, centreId: string, uai?: string, etablissementNom?: string, etablissementVille?: string) {
    if (!etablissementNom) return;
    let client = uai
      ? await this.prisma.client.findFirst({ where: { centreId, uai } })
      : await this.prisma.client.findFirst({ where: { centreId, nom: etablissementNom } });

    if (!client) {
      client = await this.prisma.client.create({
        data: { centreId, nom: etablissementNom, ville: etablissementVille ?? undefined, uai: uai ?? undefined, type: 'ETABLISSEMENT_SCOLAIRE', statut: 'CLIENT', source: 'LIAVO' },
      });
    } else if (['PROSPECT', 'CONTACTE', 'INTERESSE', 'EN_NEGOCIATION'].includes(client.statut)) {
      client = await this.prisma.client.update({ where: { id: client.id }, data: { statut: 'CLIENT' } });
    }

    await this.prisma.sejourClient.upsert({
      where: { clientId_sejourId: { clientId: client.id, sejourId } },
      create: { clientId: client.id, sejourId },
      update: {},
    });

    // Pont RelationCommerciale — récupère les organisationId des deux parties
    try {
      const centre = await this.prisma.centreHebergement.findUnique({
        where: { id: centreId },
        select: { organisationId: true },
      });
      if (client.organisationId && centre?.organisationId) {
        await this.prisma.relationCommerciale.upsert({
          where: {
            organisationHebergeurId_organisationClienteId: {
              organisationHebergeurId: centre.organisationId,
              organisationClienteId: client.organisationId,
            },
          },
          create: {
            organisationHebergeurId: centre.organisationId,
            organisationClienteId: client.organisationId,
            statut: 'CLIENT',
            source: 'LIAVO',
          },
          update: { statut: 'CLIENT' },
        });
      }
    } catch {
      // non bloquant — le Client est déjà créé, la RelationCommerciale est un bonus
    }

    return client;
  }

  async searchEtablissement(query: string): Promise<Array<{
    uai: string;
    nom: string;
    type: string;
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    email: string | null;
    telephone: string | null;
    academie: string | null;
  }>> {
    if (!query || query.trim().length < 2) return [];

    const API_BASE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';
    const FIELDS = 'identifiant_de_l_etablissement,nom_etablissement,type_etablissement,adresse_1,code_postal,nom_commune,mail,telephone,libelle_academie';

    const q = query.trim();
    const isUai = /^[0-9A-Za-z]{7,9}$/.test(q.replace(/\s/g, ''));
    const whereClause = isUai
      ? `identifiant_de_l_etablissement="${q.toUpperCase()}"`
      : `nom_etablissement LIKE "${q}%"`;

    const url = `${API_BASE}?select=${FIELDS}&where=${encodeURIComponent(whereClause)}&limit=10&order_by=nom_etablissement`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return [];
      const data = await res.json() as { results?: Array<Record<string, string | null>> };
      return (data.results ?? []).map(r => ({
        uai: (r.identifiant_de_l_etablissement as string) ?? '',
        nom: (r.nom_etablissement as string) ?? '',
        type: (r.type_etablissement as string) ?? '',
        adresse: (r.adresse_1 as string) ?? null,
        codePostal: (r.code_postal as string) ?? null,
        ville: (r.nom_commune as string) ?? null,
        email: (r.mail as string) ?? null,
        telephone: (r.telephone as string) ?? null,
        academie: (r.libelle_academie as string) ?? null,
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async importerProspects(academie: string, typesEtablissement: string[], userId: string) {
    const centreId = await this.getCentreId(userId);
    const API_BASE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';
    const FIELDS = 'identifiant_de_l_etablissement,nom_etablissement,type_etablissement,adresse_1,code_postal,nom_commune,mail,telephone,libelle_academie';
    const whereParts = [`libelle_academie="${academie}"`];
    if (typesEtablissement.length > 0) {
      // Normaliser : 'École'/'Ecole élémentaire'/etc. → 'Ecole' (valeur réelle dans l'API)
      const normalize = (t: string) => {
        const lower = t.toLowerCase().replace(/[éèê]/g, 'e');
        if (lower.startsWith('ecole') || lower.startsWith('école')) return 'Ecole';
        return t;
      };
      const normalized = [...new Set(typesEtablissement.map(normalize))];
      const typeFilter = normalized.map(t => `type_etablissement="${t}"`).join(' OR ');
      whereParts.push(`(${typeFilter})`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let results: Array<Record<string, string | number | null>> = [];
    try {
      let offset = 0;
      const pageSize = 100;
      while (true) {
        const pageUrl = `${API_BASE}?select=${FIELDS}&where=${encodeURIComponent(whereParts.join(' AND '))}&limit=${pageSize}&offset=${offset}&order_by=nom_etablissement`;
        const res = await fetch(pageUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`API EN: ${res.status}`);
        const data = await res.json() as { results?: Array<Record<string, string | number | null>> };
        const page = data.results ?? [];
        results.push(...page);
        if (page.length < pageSize || results.length >= 2000) break;
        offset += pageSize;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Import annulé : délai dépassé — réessayez avec un filtre de type plus précis');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    let imported = 0;
    let skipped = 0;
    for (const r of results) {
      const uai = r.identifiant_de_l_etablissement as string;
      if (uai && await this.prisma.client.findFirst({ where: { centreId, uai } })) { skipped++; continue; }
      const typeEtab = r.type_etablissement as string;
      await this.prisma.client.create({
        data: {
          centreId,
          nom: r.nom_etablissement as string,
          type: typeEtab === 'Collège' ? 'COLLEGE'
              : typeEtab === 'Lycée' ? 'LYCEE'
              : typeEtab === 'Ecole' ? 'ECOLE'
              : 'ETABLISSEMENT_SCOLAIRE',
          adresse: (r.adresse_1 as string) ?? undefined,
          ville: (r.nom_commune as string) ?? undefined,
          codePostal: (r.code_postal as string) ?? undefined,
          telephone: (r.telephone as string) ?? undefined,
          email: (r.mail as string) ?? undefined,
          uai: uai ?? undefined,
          academie: (r.libelle_academie as string) ?? undefined,
          statut: 'PROSPECT',
          source: 'API_EN',
        },
      });
      imported++;
    }
    return { imported, skipped, total: results.length };
  }

  async importerDepuisCSV(
    lignes: Array<Record<string, string | undefined>>,
    userId: string,
    organisationHebergeurId?: string,
  ) {
    const centreId = await this.getCentreId(userId);
    let imported = 0;
    let skipped = 0;

    for (const ligne of lignes) {
      const nom = ligne.nom?.trim();
      if (!nom) continue;
      const uai = ligne.uai?.trim() || undefined;
      const existing = uai
        ? await this.prisma.client.findFirst({ where: { centreId, uai } })
        : await this.prisma.client.findFirst({ where: { centreId, nom } });

      if (existing) { skipped++; continue; }

      const created = await this.prisma.client.create({
        data: {
          centreId,
          nom,
          type: ligne.type?.trim() || 'ETABLISSEMENT_SCOLAIRE',
          statut: ligne.statut?.trim() || 'PROSPECT',
          ville: ligne.ville?.trim() || undefined,
          codePostal: ligne.codePostal?.trim() || undefined,
          telephone: ligne.telephone?.trim() || undefined,
          email: ligne.email?.trim() || undefined,
          uai: uai,
          notes: ligne.notes?.trim() || undefined,
          source: 'IMPORT_CSV',
        },
      });

      // Pont RelationCommerciale — non bloquant
      if (organisationHebergeurId && created.organisationId) {
        try {
          await this.prisma.relationCommerciale.upsert({
            where: {
              organisationHebergeurId_organisationClienteId: {
                organisationHebergeurId,
                organisationClienteId: created.organisationId,
              },
            },
            create: {
              organisationHebergeurId,
              organisationClienteId: created.organisationId,
              statut: (created.statut as any) ?? 'PROSPECT',
              source: 'IMPORT_CSV',
            },
            update: {},
          });
        } catch { /* non bloquant */ }
      }

      imported++;
    }
    return { imported, skipped, total: lignes.length };
  }

  async importerContactsCSV(
    lignes: Array<Record<string, string>>,
    userId: string,
  ): Promise<{ imported: number; skipped: number; clientNotFound: number; total: number }> {
    const centreId = await this.getCentreId(userId);
    let imported = 0;
    let skipped = 0;
    let clientNotFound = 0;

    for (const ligne of lignes) {
      const etablissement = ligne['etablissement']?.trim();
      const prenom = ligne['prenom']?.trim() ?? '';
      const nom = ligne['nom']?.trim() ?? '';
      const email = ligne['email']?.trim() ?? '';
      const telephone = ligne['telephone']?.trim() ?? '';
      const role = ligne['role']?.trim() ?? '';

      if (!etablissement || (!prenom && !nom)) continue;

      const client = await this.prisma.client.findFirst({
        where: { centreId, nom: etablissement },
      });

      if (!client) { clientNotFound++; continue; }

      const existing = email
        ? await this.prisma.contactClient.findFirst({ where: { clientId: client.id, email } })
        : await this.prisma.contactClient.findFirst({ where: { clientId: client.id, prenom, nom } });

      if (existing) { skipped++; continue; }

      await this.prisma.contactClient.create({
        data: {
          clientId: client.id,
          prenom,
          nom,
          email: email || undefined,
          telephone: telephone || undefined,
          role: role || undefined,
        },
      });
      imported++;
    }

    return { imported, skipped, clientNotFound, total: lignes.length };
  }

  async envoyerBrochure(clientId: string, userId: string) {
    const centreId = await this.getCentreId(userId);
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { contacts: { take: 1 } },
    });
    if (!client || client.centreId !== centreId) throw new ForbiddenException();

    const emailDestinataire = client.email ?? client.contacts[0]?.email ?? null;
    if (!emailDestinataire) {
      throw new BadRequestException('Aucun email disponible pour ce client');
    }

    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: centreId },
      select: { brochureUrl: true },
    });

    const brochureUrl = centre?.brochureUrl ?? null;
    if (!brochureUrl) {
      throw new BadRequestException('Brochure non configurée — contactez l\'administrateur');
    }

    await this.email.sendGenericNotification(
      emailDestinataire,
      'Votre brochure — Chalet Le Sauvageon',
      `<p>Bonjour ${client.nom},</p>
       <p>Veuillez trouver ci-dessous notre brochure présentant le Chalet Le Sauvageon.</p>
       <p><a href="${brochureUrl}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none">📄 Télécharger la brochure</a></p>
       <p>N'hésitez pas à nous contacter pour toute question.</p>`,
      'Chalet Le Sauvageon',
    );

    await this.prisma.activiteClient.create({
      data: {
        clientId,
        centreId,
        type: 'BROCHURE',
        description: `Brochure envoyée à ${emailDestinataire}`,
        metadata: { email: emailDestinataire },
        userId,
      },
    });

    return { success: true };
  }
}
