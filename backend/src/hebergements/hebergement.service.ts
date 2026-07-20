import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { SearchHebergementDto } from './dto/search-hebergement.dto.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';
import { DEPT_TO_REGION, normaliserDepartement } from '../utils/departements.js';

const API_BASE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-catalogue-structures-accueil-hebergement/records';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ApiRecord {
  identifiant: string;
  nom_de_la_structure_d_accueil_et_d_hebergement_fr: string;
  nom_du_lieu_d_accueil_ville: string;
  nom_du_lieu_d_accueil_departement: string;
  nom_du_lieu_d_accueil_region: string;
  nom_du_lieu_d_accueil_code_postal: string;
  nom_du_lieu_d_accueil_latitude: number | null;
  nom_du_lieu_d_accueil_longitude: number | null;
  nombre_de_lits_pour_les_eleves: number | null;
  nombre_de_lits_pour_les_adultes_assurant_l_encadrement: number | null;
  description_longue: string | null;
  image: string | null;
  permalien: string | null;
  outils_d_inscription: string | null;
  thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement: string[] | null;
  activites_proposees_par_la_structure_d_accueil_et_d_hebergement: string[] | null;
  accessibilite_de_la_structure_d_accueil_et_d_hebergement_aux_eleves_en_situation_de_handicap: string | null;
  avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite: string | null;
  periode_d_ouverture_annuelle_de_la_structure_pour_l_accueil_des_eleves_dans_le_cadre_de_voyages_scol: string | null;
}

interface ApiResponse {
  total_count: number;
  results: ApiRecord[];
}

function mapRecord(r: ApiRecord) {
  return {
    id: r.identifiant,
    nom: r.nom_de_la_structure_d_accueil_et_d_hebergement_fr,
    ville: r.nom_du_lieu_d_accueil_ville,
    departement: r.nom_du_lieu_d_accueil_departement,
    region: r.nom_du_lieu_d_accueil_region,
    codePostal: r.nom_du_lieu_d_accueil_code_postal,
    latitude: r.nom_du_lieu_d_accueil_latitude,
    longitude: r.nom_du_lieu_d_accueil_longitude,
    capaciteEleves: r.nombre_de_lits_pour_les_eleves,
    capaciteAdultes: r.nombre_de_lits_pour_les_adultes_assurant_l_encadrement,
    description: r.description_longue,
    image: r.image,
    // Récord EN : une seule photo à la source — galerie réduite à la couverture.
    images: r.image ? [r.image] : [],
    permalien: r.permalien,
    contact: r.outils_d_inscription,
    thematiques: r.thematiques_principales_proposees_par_la_structure_d_accueil_et_d_hebergement ?? [],
    activites: r.activites_proposees_par_la_structure_d_accueil_et_d_hebergement ?? [],
    // L'API education.gouv n'expose pas les équipements.
    equipements: [],
    accessible: r.accessibilite_de_la_structure_d_accueil_et_d_hebergement_aux_eleves_en_situation_de_handicap === 'Oui',
    avisSecurite: r.avis_rendu_par_la_commission_consultative_departementale_de_securite_et_d_accessibilite,
    periodeOuverture: r.periode_d_ouverture_annuelle_de_la_structure_pour_l_accueil_des_eleves_dans_le_cadre_de_voyages_scol,
    // Record EN : pas en base, donc jamais revendiqué.
    isClaimed: false,
  };
}

function mapCentre(c: any) {
  return {
    id: c.id,
    nom: c.nom,
    ville: c.ville,
    departement: c.departement ?? '',
    region: DEPT_TO_REGION[normaliserDepartement(c.departement) ?? ''] ?? '',
    codePostal: c.codePostal,
    latitude: null,
    longitude: null,
    capaciteEleves: c.capacite,
    capaciteAdultes: c.capaciteAdultes ?? null,
    description: c.description,
    image: c.imageUrl ?? null,
    // Galerie §3.11 — self-heal : centre importé (imageUrl sans galerie) → couverture seule.
    images: c.imagesUrls?.length ? c.imagesUrls : c.imageUrl ? [c.imageUrl] : [],
    permalien: null,
    contact: c.telephone ?? c.email ?? null,
    thematiques: c.thematiquesCentre ?? [],
    activites: c.activitesCentre ?? [],
    equipements: c.equipements ?? [],
    accessible: c.accessiblePmr ?? false,
    avisSecurite: c.avisSecurite ?? null,
    periodeOuverture: c.periodeOuverture ?? null,
    source: c.source ?? null,
    reseau: c.reseau ?? null,
    // userId non-null = centre déjà revendiqué (source de vérité). Non exposé tel quel.
    isClaimed: !!c.userId,
  };
}

@Injectable()
export class HebergementService {
  constructor(private prisma: PrismaService, private email: EmailService) {}

  async search(dto: SearchHebergementDto) {
    // ── Requête API Éducation Nationale ──────────────────────────────────
    const clauses: string[] = [];

    if (dto.nom) {
      clauses.push(`search(nom_de_la_structure_d_accueil_et_d_hebergement_fr,"${dto.nom}")`);
    }
    if (dto.ville) {
      clauses.push(`search(nom_du_lieu_d_accueil_ville,"${dto.ville}")`);
    }
    if (dto.departement) {
      clauses.push(`search(nom_du_lieu_d_accueil_departement,"${dto.departement}")`);
    }
    if (dto.region) {
      clauses.push(`search(nom_du_lieu_d_accueil_region,"${dto.region}")`);
    }

    const params = new URLSearchParams({ limit: '50' });
    if (clauses.length > 0) {
      params.set('where', clauses.join(' AND '));
    }

    const apiPromise = fetch(`${API_BASE}?${params}`).then((r) => r.json()) as Promise<ApiResponse>;

    // ── Requête Prisma (centres Liavo ACTIVE) ───────────────────────────
    const where: any = { statut: 'ACTIVE' };
    const andClauses: any[] = [];

    if (dto.nom) {
      andClauses.push({
        OR: [
          { nom: { contains: dto.nom, mode: 'insensitive' } },
          { ville: { contains: dto.nom, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.ville) {
      andClauses.push({
        OR: [
          { ville: { contains: dto.ville, mode: 'insensitive' } },
          { nom: { contains: dto.ville, mode: 'insensitive' } },
        ],
      });
    }
    if (dto.departement) {
      andClauses.push({ departement: { contains: dto.departement, mode: 'insensitive' } });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const prismaPromise = this.prisma.centreHebergement.findMany({ where, take: 50 });
    const prismaCountPromise = this.prisma.centreHebergement.count({ where });

    // ── Exécution parallèle ─────────────────────────────────────────────
    const [apiData, centres, centresCount] = await Promise.all([
      apiPromise,
      prismaPromise,
      prismaCountPromise,
    ]);

    const liavoResults = centres.map(mapCentre);
    const enResults = apiData.results.map(mapRecord);

    const liavoBas = new Set(liavoResults.map(r => r.nom.toLowerCase().trim()));
    // Dédup par apidaeId (identifiant EN) : les noms diffèrent souvent entre base
    // et API EN, le match par nom seul laisse passer des doublons. centres = brut
    // Prisma (contient apidaeId), liavoResults est déjà mappé et ne l'a pas.
    const liavoApidaeIds = new Set(
      centres.filter((c: any) => c.apidaeId).map((c: any) => String(c.apidaeId))
    );
    const enFiltered = enResults.filter(
      r => !liavoBas.has(r.nom.toLowerCase().trim()) && !liavoApidaeIds.has(String(r.id))
    );

    return {
      total: centresCount + (apiData.total_count - (enResults.length - enFiltered.length)),
      results: [...liavoResults, ...enFiltered],
    };
  }

  async findById(id: string) {
    if (UUID_RE.test(id)) {
      const centre = await this.prisma.centreHebergement.findFirst({
        where: { id, statut: 'ACTIVE' },
      });
      if (centre) return mapCentre(centre);
      throw new NotFoundException('Hébergement introuvable');
    }

    const params = new URLSearchParams({
      limit: '1',
      where: `identifiant="${id}"`,
    });

    const res = await fetch(`${API_BASE}?${params}`);
    const data: ApiResponse = await res.json();

    if (!data.results.length) {
      throw new NotFoundException('Hébergement introuvable');
    }

    return mapRecord(data.results[0]);
  }

  async manifesterInteret(centreId: string, enseignantId: string, message?: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { id: centreId, source: 'APIDAE' },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const enseignant = await this.prisma.user.findUnique({
      where: { id: enseignantId },
      select: { id: true, prenom: true, nom: true, email: true },
    });
    if (!enseignant) throw new NotFoundException('Enseignant introuvable');

    const orgaEnseignant = await getOrganisationPrincipale(enseignantId, this.prisma);
    const nomEtablissement = orgaEnseignant?.nom ?? null;

    // Trouver l'email du réseau correspondant
    const reseauUser = await this.prisma.user.findFirst({
      where: { role: 'RESEAU', reseauNom: centre.reseau ?? undefined },
      select: { email: true, reseauNomComplet: true },
    });

    const nomReseau = reseauUser?.reseauNomComplet ?? centre.reseau ?? 'le réseau';
    const emailReseau = reseauUser?.email ?? null;

    // Email à l'enseignant — confirmation
    await this.email.sendGenericNotification(
      enseignant.email,
      `Votre intérêt pour ${centre.nom} a bien été transmis`,
      `<p>Bonjour ${enseignant.prenom},</p>
       <p>Nous avons transmis votre intérêt pour le centre <strong>${centre.nom}</strong> (${centre.ville}) à ${nomReseau}.</p>
       <p>Le réseau va contacter ce centre pour l'inviter à rejoindre LIAVO. Vous serez informé dès qu'il sera disponible pour recevoir des demandes.</p>
       <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/teacher/hebergements" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Retour au catalogue</a></p>`,
    );

    // Email au réseau — signal enseignant
    if (emailReseau) {
      await this.email.sendGenericNotification(
        emailReseau,
        `Un enseignant est intéressé par ${centre.nom}`,
        `<p>Bonjour,</p>
         <p>L'enseignant <strong>${enseignant.prenom} ${enseignant.nom}</strong>${nomEtablissement ? ` (${nomEtablissement})` : ''} a manifesté son intérêt pour le centre <strong>${centre.nom}</strong> à ${centre.ville}.</p>
         ${message ? `<p>Message : <em>${message}</em></p>` : ''}
         ${centre.email ? `<p>Email du centre : <a href="mailto:${centre.email}">${centre.email}</a></p>` : ''}
         <p>Ce centre n'est pas encore inscrit sur LIAVO. Nous vous suggérons de le contacter pour accélérer son onboarding.</p>`,
      );
    }

    // Email au centre — invitation découverte
    if (centre.email) {
      await this.email.sendGenericNotification(
        centre.email,
        `Un enseignant recherche un hébergement — découvrez LIAVO`,
        `<p>Bonjour,</p>
         <p>Un enseignant${nomEtablissement ? ` de ${nomEtablissement}` : ''} est intéressé par votre centre <strong>${centre.nom}</strong> pour organiser un séjour scolaire.</p>
         <p>LIAVO est la plateforme de coordination des séjours scolaires qui vous permet de recevoir des demandes de devis, gérer vos disponibilités et facturer directement.</p>
         ${message ? `<p>Message de l'enseignant : <em>${message}</em></p>` : ''}
         <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/hebergeur" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Créer mon espace hébergeur</a></p>
         <p style="font-size:12px;color:#666;">Vous recevez cet email car votre centre est référencé dans le réseau ${nomReseau}.</p>`,
      );
    }

    return { success: true };
  }
}
