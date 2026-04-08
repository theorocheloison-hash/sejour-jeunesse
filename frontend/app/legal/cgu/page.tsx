import Link from 'next/link';

export const metadata = {
  title: "Conditions Générales d'Utilisation — LIAVO",
  description: 'CGU LIAVO pour les établissements scolaires, enseignants, directeurs, rectorat et parents',
};

export default function CguPage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const h3Cls = 'text-sm font-bold text-gray-800 mb-2 mt-4';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';
  const liCls = 'text-sm text-gray-700 leading-relaxed';
  const warnCls = 'rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4';

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
              <p className="text-xs text-gray-500">SASU — SIRET 102 994 910 00010 — RCS Annecy</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conditions Générales d&apos;Utilisation</h1>
          <p className="text-sm text-gray-500">Version 1.0 — En vigueur depuis mars 2026 — Réservées aux établissements scolaires, enseignants, directeurs, rectorat et parents</p>
        </div>

        <div className={warnCls}>
          <p className="text-sm text-amber-800 font-medium">
            Les présentes CGU s&apos;appliquent exclusivement aux utilisateurs non payants de LIAVO : enseignants, directeurs d&apos;établissement, agents du rectorat et parents d&apos;élèves. Les conditions applicables aux hébergeurs font l&apos;objet de{' '}
            <Link href="/legal/cgv-hebergeurs" className="underline">CGV spécifiques</Link>.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>1. Objet et acceptation</h2>
          <p className={pCls}>
            LIAVO est une plateforme SaaS de coordination des séjours scolaires, éditée par LIAVO SASU (ci-après « LIAVO »), qui met en relation les établissements scolaires, les centres d&apos;hébergement, les accompagnateurs et les familles dans le cadre de séjours scolaires collectifs.
          </p>
          <p className={pCls}>
            L&apos;accès et l&apos;utilisation de la plateforme impliquent l&apos;acceptation sans réserve des présentes CGU. En créant un compte ou en accédant à la plateforme via un lien d&apos;invitation, l&apos;utilisateur reconnaît avoir lu et accepté les présentes conditions.
          </p>
          <p className={pCls}>
            <strong>L&apos;utilisation de LIAVO est entièrement gratuite pour les établissements scolaires, enseignants, directeurs, agents du rectorat et parents d&apos;élèves.</strong> LIAVO se réserve le droit de faire évoluer ce modèle avec un préavis de 90 jours.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>2. Description du service</h2>
          <p className={pCls}>LIAVO met à disposition des fonctionnalités adaptées à chaque rôle :</p>

          <h3 className={h3Cls}>Enseignant (TEACHER)</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Création et gestion de séjours scolaires',
              'Accès au catalogue de 649+ centres référencés (API Éducation Nationale)',
              "Lancement d'appels d'offres et réception de devis",
              'Gestion des autorisations parentales numériques',
              'Génération des ordres de mission accompagnateurs',
              "Espace collaboratif avec le centre d'hébergement sélectionné",
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <h3 className={h3Cls}>Directeur d&apos;établissement (DIRECTOR)</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Validation et signature électronique des séjours',
              'Soumission des dossiers au rectorat',
              "Validation des factures d'acompte",
              'Aperçu Chorus Pro des documents de facturation',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <h3 className={h3Cls}>Rectorat / DSDEN (RECTOR)</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Réception et consultation des dossiers de séjour soumis par les établissements',
              'Vision consolidée de tous les séjours de la zone académique',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <h3 className={h3Cls}>Parent (PARENT)</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Réception des autorisations parentales par email',
              'Signature en ligne des autorisations',
              "Renseignement des informations de l'élève (santé, régime, assurance)",
              'Paiement en ligne échelonné',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>3. Création de compte et accès</h2>
          <p className={pCls}>
            L&apos;accès à la plateforme nécessite la création d&apos;un compte avec une adresse email valide. L&apos;utilisateur s&apos;engage à fournir des informations exactes et à les maintenir à jour.
          </p>
          <p className={pCls}>
            Chaque utilisateur est responsable de la confidentialité de ses identifiants. Toute utilisation du compte est réputée effectuée par le titulaire. En cas de compromission suspectée, l&apos;utilisateur doit contacter immédiatement <a href="mailto:contact@liavo.fr" className="text-[#1B4060] underline">contact@liavo.fr</a>.
          </p>
          <p className={pCls}>
            Les enseignants et directeurs sont créés dans le contexte d&apos;un établissement scolaire identifié par son UAI (code établissement Éducation Nationale). LIAVO se réserve le droit de vérifier la légitimité des inscriptions.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>4. Données des élèves mineurs — obligations spécifiques</h2>
          <div className={warnCls}>
            <p className="text-sm text-amber-800 font-semibold mb-2">⚠ Point d&apos;attention particulier</p>
            <p className="text-sm text-amber-800">
              LIAVO traite des données personnelles d&apos;élèves mineurs (nom, prénom, date de naissance, données médicales, régime alimentaire). L&apos;enseignant créateur du séjour agit en qualité de représentant du responsable de traitement (l&apos;établissement scolaire).
            </p>
          </div>
          <p className={pCls}>L&apos;enseignant s&apos;engage à :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'N\'utiliser LIAVO que pour des séjours scolaires légitimes dans le cadre de ses fonctions',
              "Informer les parents de l'utilisation de LIAVO pour la gestion du séjour",
              'Ne collecter que les données strictement nécessaires à l\'organisation du séjour',
              'Ne pas télécharger ou exporter les données personnelles des élèves en dehors du cadre légal',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className={pCls}>
            Les parents signataires d&apos;une autorisation parentale consentent expressément au traitement des données de leur enfant par LIAVO pour les finalités décrites dans la{' '}
            <Link href="/legal/confidentialite" className="text-[#1B4060] underline">politique de confidentialité</Link>.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>5. Responsabilités</h2>
          <h3 className={h3Cls}>5.1 Responsabilité de LIAVO</h3>
          <p className={pCls}>
            LIAVO s&apos;engage à assurer la disponibilité de la plateforme (objectif 99,5 % mensuel hors maintenance programmée) et à traiter les données personnelles conformément au RGPD.
          </p>
          <p className={pCls}>LIAVO est un intermédiaire technique. Sa responsabilité est expressément exclue pour :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "L'exécution effective du séjour et tout événement survenant pendant celui-ci",
              "La qualité des prestations fournies par les centres d'hébergement",
              'Les décisions administratives des établissements scolaires ou du rectorat',
              'Les retards de paiement entre les parties',
              'Les erreurs dans les données saisies par les utilisateurs',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>

          <h3 className={h3Cls}>5.2 Responsabilité de l&apos;utilisateur</h3>
          <p className={pCls}>
            L&apos;utilisateur est seul responsable des données qu&apos;il saisit sur la plateforme, de la légitimité de son usage, et du respect des règles applicables à sa fonction (obligations fonctionnaires, règles de l&apos;Éducation Nationale).
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>6. Signature électronique</h2>
          <p className={pCls}>
            Les signatures électroniques réalisées sur LIAVO (autorisations parentales, ordres de mission) constituent des signatures électroniques simples au sens du règlement eIDAS (Règlement UE 910/2014). Leur valeur probante est reconnue par l&apos;article 1366 du Code civil.
          </p>
          <p className={pCls}>
            LIAVO conserve les métadonnées de chaque signature (horodatage, adresse IP, identifiant de session) à titre de preuve.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>7. Suspension et résiliation</h2>
          <p className={pCls}>
            L&apos;utilisateur peut supprimer son compte à tout moment depuis ses paramètres ou en contactant <a href="mailto:contact@liavo.fr" className="text-[#1B4060] underline">contact@liavo.fr</a>. La suppression entraîne la clôture des séjours en cours et la conservation des données légalement requises.
          </p>
          <p className={pCls}>
            LIAVO se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGU, sans préavis en cas de manquement grave.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>8. Modification des CGU</h2>
          <p className={pCls}>
            LIAVO peut modifier les présentes CGU à tout moment. Les utilisateurs sont notifiés par email avec un préavis de 30 jours. La poursuite de l&apos;utilisation après ce délai vaut acceptation des nouvelles conditions.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>9. Droit applicable</h2>
          <p className={pCls}>
            Les présentes CGU sont soumises au droit français. Tout litige relève de la compétence du Tribunal de commerce d&apos;Annecy, sauf disposition légale impérative contraire.
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
