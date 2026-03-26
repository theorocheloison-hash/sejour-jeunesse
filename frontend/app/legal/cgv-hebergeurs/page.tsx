import Link from 'next/link';

export const metadata = {
  title: 'Conditions Générales de Vente Hébergeurs — LIAVO',
  description: "CGV LIAVO applicables aux centres d'hébergement abonnés",
};

export default function CgvHebergeurPage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const h3Cls = 'text-sm font-bold text-gray-800 mb-2 mt-4';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';
  const liCls = 'text-sm text-gray-700 leading-relaxed';
  const warnCls = 'rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4';
  const infoCls = 'rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#1B4060] flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div>
              <span className="text-lg font-bold text-[#1B4060]">Liavo</span>
              <p className="text-xs text-gray-500">SASU — 472 route du Mas Devant, 74440 MORILLON — RCS ANNECY</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conditions Générales de Vente — Hébergeurs</h1>
          <p className="text-sm text-gray-500">Version 1.0 — En vigueur depuis mars 2026 — Applicables aux centres d&apos;hébergement</p>
        </div>

        <div className={infoCls}>
          <p className="text-sm text-blue-800">
            Les présentes CGV s&apos;appliquent exclusivement aux centres d&apos;hébergement (personnes physiques ou morales exploitant un établissement d&apos;hébergement) qui s&apos;inscrivent sur LIAVO en qualité de fournisseur de séjours scolaires.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>1. Objet</h2>
          <p className={pCls}>
            Les présentes CGV définissent les conditions dans lesquelles LIAVO SASU (ci-après « LIAVO ») fournit un accès à sa plateforme SaaS aux centres d&apos;hébergement (ci-après « l&apos;Hébergeur ») dans le cadre de la mise en relation avec des établissements scolaires pour l&apos;organisation de séjours collectifs.
          </p>
          <p className={pCls}>
            L&apos;Hébergeur reconnaît avoir pris connaissance des présentes CGV avant toute souscription. Toute souscription à un abonnement LIAVO implique l&apos;acceptation pleine et entière des présentes CGV.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>2. Description des services</h2>
          <p className={pCls}>LIAVO met à disposition de l&apos;Hébergeur abonné :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Accès aux appels d'offres qualifiés émis par les établissements scolaires",
              'Création et envoi de devis structurés (HT/TTC, lignes de prestations)',
              'Espace collaboratif avec les enseignants (messagerie, planning, documents)',
              'Gestion du catalogue de prestations et des disponibilités',
              "Stockage et gestion des documents de conformité (agrément EN, assurance RC)",
              "Génération de factures d'acompte et de solde",
              'Export Chorus Pro au format PEPPOL UBL 2.1 (mandat de facturation requis)',
              'CRM clients établissements scolaires',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>3. Abonnement et tarification</h2>
          <div className={warnCls}>
            <p className="text-sm text-amber-800 font-semibold mb-1">Tarifs en cours de définition</p>
            <p className="text-sm text-amber-800">
              Les tarifs d&apos;abonnement sont en cours de finalisation. Les premiers hébergeurs partenaires bénéficieront d&apos;un accès préférentiel. Contactez <a href="mailto:contact@liavo.fr" className="text-amber-700 underline">contact@liavo.fr</a> pour connaître les conditions applicables à votre situation.
            </p>
          </div>

          <h3 className={h3Cls}>3.1 Formules disponibles</h3>
          <p className={pCls}>
            LIAVO propose des abonnements mensuels et annuels. Le détail des formules et des tarifs en vigueur est accessible depuis l&apos;espace d&apos;inscription hébergeur sur liavo.fr.
          </p>

          <h3 className={h3Cls}>3.2 Modalités de paiement</h3>
          <p className={pCls}>
            Le paiement s&apos;effectue par prélèvement bancaire ou virement. Les factures sont émises mensuellement ou annuellement selon la formule choisie. Tout abonnement commencé est dû intégralement.
          </p>

          <h3 className={h3Cls}>3.3 Révision tarifaire</h3>
          <p className={pCls}>
            LIAVO se réserve le droit de modifier ses tarifs avec un préavis de 60 jours. L&apos;Hébergeur peut résilier son abonnement avant l&apos;entrée en vigueur des nouveaux tarifs.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>4. Durée et résiliation</h2>
          <h3 className={h3Cls}>4.1 Durée</h3>
          <p className={pCls}>
            L&apos;abonnement est conclu pour la durée choisie (mensuelle ou annuelle) et se renouvelle automatiquement par tacite reconduction, sauf résiliation dans les conditions ci-après.
          </p>

          <h3 className={h3Cls}>4.2 Résiliation par l&apos;Hébergeur</h3>
          <p className={pCls}>
            L&apos;Hébergeur peut résilier son abonnement à tout moment depuis ses paramètres LIAVO, avec effet à la fin de la période d&apos;abonnement en cours. Aucun remboursement prorata temporis n&apos;est effectué sauf disposition légale contraire.
          </p>

          <h3 className={h3Cls}>4.3 Résiliation par LIAVO</h3>
          <p className={pCls}>
            LIAVO peut résilier l&apos;abonnement avec un préavis de 30 jours, ou immédiatement en cas de violation grave des présentes CGV (notamment : fausse déclaration, utilisation frauduleuse, atteinte aux droits de tiers).
          </p>

          <h3 className={h3Cls}>4.4 Effets de la résiliation</h3>
          <p className={pCls}>
            À la date d&apos;effet de la résiliation, l&apos;accès à la plateforme est suspendu. Les données de l&apos;Hébergeur sont conservées 6 mois supplémentaires puis supprimées, sauf obligation légale de conservation.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>5. Obligations de l&apos;Hébergeur</h2>
          <p className={pCls}>L&apos;Hébergeur s&apos;engage à :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Fournir des informations exactes et à jour (SIRET, agrément EN, assurance RC, IBAN)",
              'Maintenir à jour ses documents de conformité (agrément, assurance)',
              'Ne soumettre que des devis sincères et réalisables',
              "Respecter les conditions d'hébergement et de sécurité applicables aux séjours scolaires",
              "Ne pas utiliser la plateforme à des fins autres que la mise en relation avec des établissements scolaires",
              'Conserver les factures émises via LIAVO pendant 10 ans (obligation comptable)',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <div className={warnCls}>
            <p className="text-sm text-amber-800 font-semibold mb-1">Agrément Éducation Nationale</p>
            <p className="text-sm text-amber-800">
              L&apos;Hébergeur est seul responsable du maintien de son agrément Éducation Nationale en cours de validité. LIAVO ne garantit pas la validité des agréments déclarés. Tout séjour réalisé avec un agrément expiré engage la seule responsabilité de l&apos;Hébergeur.
            </p>
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>6. Mandat de facturation Chorus Pro</h2>
          <p className={pCls}>
            L&apos;utilisation des fonctionnalités de facturation électronique Chorus Pro est conditionnée à l&apos;acceptation préalable du{' '}
            <Link href="/legal/mandat-facturation" className="text-[#1B4060] underline">mandat de facturation</Link>{' '}
            (version 1.0 en vigueur). Ce mandat est partie intégrante des présentes CGV.
          </p>
          <p className={pCls}>
            Sans acceptation du mandat, l&apos;Hébergeur peut accéder à toutes les autres fonctionnalités de la plateforme mais ne peut pas générer de documents Chorus Pro.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>7. Responsabilités</h2>
          <h3 className={h3Cls}>7.1 Responsabilité de LIAVO</h3>
          <p className={pCls}>
            La responsabilité de LIAVO est limitée aux dysfonctionnements techniques directement imputables à la plateforme. En tout état de cause, elle est plafonnée au montant des sommes versées par l&apos;Hébergeur au titre des 12 derniers mois d&apos;abonnement.
          </p>
          <p className={pCls}>LIAVO n&apos;est pas responsable :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Des décisions d'achat des établissements scolaires",
              "Du nombre d'appels d'offres reçus (aucune garantie de volume)",
              "Des litiges commerciaux entre l'Hébergeur et les établissements scolaires",
              "Des rejets de factures Chorus Pro résultant d'informations erronées de l'Hébergeur",
              "Des conséquences d'un agrément EN expiré ou invalide",
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <h3 className={h3Cls}>7.2 Responsabilité de l&apos;Hébergeur</h3>
          <p className={pCls}>
            L&apos;Hébergeur est seul responsable de l&apos;exécution des séjours, de la conformité de ses installations, du respect de la réglementation applicable aux séjours scolaires (normes de sécurité, encadrement, agrément), et de la véracité de toutes les informations communiquées sur la plateforme.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>8. Données personnelles</h2>
          <p className={pCls}>
            Dans le cadre de son abonnement, l&apos;Hébergeur accède à des données personnelles d&apos;enseignants et de représentants d&apos;établissements scolaires. Ces données sont communiquées dans le seul cadre de la mise en relation pour un séjour spécifique. L&apos;Hébergeur s&apos;interdit tout usage de ces données à d&apos;autres fins.
          </p>
          <p className={pCls}>
            L&apos;Hébergeur n&apos;a pas accès aux données personnelles des élèves mineurs. Ces données restent exclusivement dans le périmètre enseignant/parents/plateforme.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>9. Propriété intellectuelle</h2>
          <p className={pCls}>
            L&apos;Hébergeur conserve la propriété de son contenu (descriptions, photos, tarifs) déposé sur LIAVO. Il accorde à LIAVO une licence d&apos;utilisation non exclusive pour l&apos;affichage de ce contenu sur la plateforme dans le cadre du service.
          </p>
          <p className={pCls}>
            La plateforme LIAVO, son code source, ses interfaces et ses marques restent la propriété exclusive de LIAVO SASU.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>10. Force majeure</h2>
          <p className={pCls}>
            Aucune partie ne pourra être tenue responsable d&apos;un manquement à ses obligations résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code civil (catastrophe naturelle, cyberattaque, pandémie, défaillance des infrastructures publiques numériques).
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>11. Droit applicable et juridiction</h2>
          <p className={pCls}>
            Les présentes CGV sont soumises au droit français. Tout litige relatif à leur interprétation ou exécution sera soumis à la compétence exclusive du Tribunal de commerce d&apos;Annecy, sauf disposition légale impérative contraire.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <Link href="/legal/mentions-legales" className="text-[#1B4060] underline">Mentions légales</Link>
          <Link href="/legal/cgu" className="text-[#1B4060] underline">CGU</Link>
          <Link href="/legal/cgv-hebergeurs" className="text-[#1B4060] underline">CGV Hébergeurs</Link>
          <Link href="/legal/confidentialite" className="text-[#1B4060] underline">Confidentialité</Link>
          <Link href="/legal/mandat-facturation" className="text-[#1B4060] underline">Mandat de facturation</Link>
          <Link href="/" className="text-gray-500 underline">Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  );
}
