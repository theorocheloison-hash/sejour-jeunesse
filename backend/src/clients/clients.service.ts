import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
  constructor(private prisma: PrismaService) {}

  private async getCentreId(userId: string): Promise<string> {
    const centre = await this.prisma.centreHebergement.findFirst({ where: { userId } });
    if (!centre) throw new ForbiddenException('Centre introuvable');
    return centre.id;
  }

  async getMesClients(userId: string) {
    const centreId = await this.getCentreId(userId);
    return this.prisma.client.findMany({
      where: { centreId },
      include: { contacts: true, rappels: { orderBy: { dateEcheance: 'asc' } }, sejours: true },
      orderBy: { nom: 'asc' },
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
    return this.prisma.contactClient.create({ data: { ...dto, clientId } });
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
    return this.prisma.rappel.create({
      data: { clientId, type: dto.type, dateEcheance: new Date(dto.dateEcheance), description: dto.description, statut: dto.statut ?? 'A_FAIRE' },
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
    return client;
  }

  async importerProspects(academie: string, typesEtablissement: string[], userId: string) {
    const centreId = await this.getCentreId(userId);
    const API_BASE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';
    const FIELDS = 'identifiant_de_l_etablissement,nom_etablissement,type_etablissement,adresse_1,code_postal,nom_commune,mail,telephone,libelle_academie';
    const whereParts = [`libelle_academie="${academie}"`];
    if (typesEtablissement.length > 0) {
      const typeFilter = typesEtablissement.map(t => `type_etablissement="${t}"`).join(' OR ');
      whereParts.push(`(${typeFilter})`);
    }
    const url = `${API_BASE}?select=${FIELDS}&where=${encodeURIComponent(whereParts.join(' AND '))}&limit=100&order_by=nom_etablissement`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let results: Array<Record<string, string | number | null>> = [];
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`API EN: ${res.status}`);
      const data = await res.json() as { results?: Array<Record<string, string | number | null>> };
      results = data.results ?? [];
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Import annulé : l\'API Éducation Nationale n\'a pas répondu dans les 10 secondes');
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
              : (typeEtab === 'Ecole élémentaire' || typeEtab === 'Ecole maternelle' || typeEtab === 'Ecole primaire') ? 'ECOLE'
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

      await this.prisma.client.create({
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
}
