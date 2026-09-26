import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { JOURS_CONSERVATION_SANTE } from '../common/champs-inscription.constants.js';

/**
 * Point 6b — purge automatique des données de santé des inscrits (allergies,
 * infos médicales, document médical) JOURS_CONSERVATION_SANTE jours après la
 * fin du séjour : tient la promesse affichée aux parents (« supprimées
 * automatiquement 30 jours après le séjour »). Le reste de la fiche (identité,
 * contact, logistique, consentements tracés) est conservé.
 * Idempotente : cible toute ligne d'un séjour terminé qui porte encore une
 * donnée de santé (y compris ressaisie après une première purge).
 */
@Injectable()
export class PurgeSanteService {
  private readonly logger = new Logger(PurgeSanteService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /** 3h Europe/Paris — même garde que les autres crons (ENABLE_CRON=true en prod uniquement). */
  @Cron('0 3 * * *', { timeZone: 'Europe/Paris' })
  async cronPurge() {
    if (process.env.ENABLE_CRON !== 'true') return;
    try {
      const { purgees } = await this.purgerDonneesSante();
      this.logger.log(`[purgeSante] ${purgees} fiche(s) purgée(s)`);
    } catch (err) {
      this.logger.error('[purgeSante] échec', err as Error);
    }
  }

  async purgerDonneesSante(now: Date = new Date()): Promise<{ purgees: number }> {
    const limite = new Date(now.getTime() - JOURS_CONSERVATION_SANTE * 86400000);
    const cibles = await this.prisma.autorisationParentale.findMany({
      where: {
        sejour: { dateFin: { lt: limite } },
        OR: [
          { allergies: { not: null } },
          { infosMedicales: { not: null } },
          { documentMedicalUrl: { not: null } },
        ],
      },
      select: { id: true, documentMedicalUrl: true },
    });
    if (cibles.length === 0) return { purgees: 0 };

    // Fichiers OVH d'abord (best effort, erreurs absorbées par StorageService),
    // puis effacement en base — une seule écriture pour tout le lot.
    for (const c of cibles) {
      if (c.documentMedicalUrl) await this.storage.delete(c.documentMedicalUrl);
    }
    const { count } = await this.prisma.autorisationParentale.updateMany({
      where: { id: { in: cibles.map((c) => c.id) } },
      data: { allergies: null, infosMedicales: null, documentMedicalUrl: null, donneesSantePurgeesAt: now },
    });
    return { purgees: count };
  }
}
