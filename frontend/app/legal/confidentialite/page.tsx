import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité — LIAVO',
  description: 'Politique de confidentialité et protection des données personnelles LIAVO',
};

export default function ConfidentialitePage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const h3Cls = 'text-sm font-bold text-gray-800 mb-2 mt-4';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';
  const liCls = 'text-sm text-gray-700 leading-relaxed';
  const blockCls = 'rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4';
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
              <p className="text-xs text-gray-500">SASU — 472 route du Mas Devant, 74440 MORILLON — RCS ANNECY</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Politique de confidentialité</h1>
          <p className="text-sm text-gray-500">Version 1.0 — En vigueur depuis mars 2026 — Conforme au RGPD (UE) 2016/679</p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>1. Responsable de traitement</h2>
          <div className={blockCls}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Entité', 'LIAVO SASU'],
                  ['Représentant légal', 'Théo ROCHE-LOISON, Président'],
                  ['Siège social', '472 route du Mas Devant, 74440 MORILLON'],
                  ['Contact DPD', 'contact@liavo.fr'],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-600 w-1/2">{label}</td>
                    <td className="py-2 text-gray-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={pCls}>
            Pour les données des élèves mineurs, LIAVO agit en qualité de <strong>sous-traitant</strong> au sens de l&apos;article 28 RGPD, les établissements scolaires étant les responsables de traitement.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>2. Données collectées et finalités</h2>

          <h3 className={h3Cls}>2.1 Comptes utilisateurs (enseignants, directeurs, rectorat)</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Données d'identification : nom, prénom, email, téléphone",
              'Données professionnelles : établissement (UAI, nom, adresse), email rectorat',
              'Données de connexion : adresse IP, horodatage, user-agent',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className="text-xs text-gray-500 mb-4">Base légale : exécution du contrat (CGU). Conservation : durée du compte + 3 ans.</p>

          <h3 className={h3Cls}>2.2 Données des élèves mineurs</h3>
          <div className={warnCls}>
            <p className="text-sm text-amber-800 font-semibold mb-1">⚠ Données sensibles — Protection renforcée</p>
            <p className="text-sm text-amber-800">
              LIAVO traite des données de catégorie spéciale (art. 9 RGPD) pour les élèves : informations médicales, régime alimentaire. Ces données ne sont accessibles qu&apos;à l&apos;enseignant créateur du séjour et au centre d&apos;hébergement sélectionné.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Identité : nom, prénom, date de naissance',
              'Données physiques : taille, poids, pointure (pour équipements)',
              'Niveau ski (séjours montagne)',
              'Régime alimentaire, informations médicales, documents médicaux uploadés',
              "Attestation d'assurance",
              "Coordonnées des parents : email, téléphone d'urgence",
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className="text-xs text-gray-500 mb-4">Base légale : consentement explicite du parent + exécution de la mission scolaire. Conservation : 1 an après la fin du séjour.</p>

          <h3 className={h3Cls}>2.3 Données hébergeurs</h3>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Données d'identification : nom, prénom, email, téléphone",
              'Données entreprise : SIRET, raison sociale, adresse, TVA, IBAN',
              "Documents : agrément EN, attestation assurance RC",
              'Données de connexion : IP, horodatage',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className="text-xs text-gray-500 mb-4">Base légale : exécution du contrat (CGV). Conservation : durée du contrat + 10 ans (obligations comptables).</p>

          <h3 className={h3Cls}>2.4 Données de navigation</h3>
          <p className={pCls}>
            LIAVO collecte des données techniques de navigation (adresse IP, navigateur, pages visitées) à des fins de sécurité et d&apos;amélioration du service. Ces données ne sont pas partagées avec des tiers à des fins publicitaires.
          </p>
          <p className="text-xs text-gray-500 mb-4">Base légale : intérêt légitime. Conservation : 12 mois.</p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>3. Destinataires des données</h2>
          <p className={pCls}>Les données sont accessibles aux personnes suivantes, dans la stricte limite de leurs besoins :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Équipe LIAVO : accès restreint aux données nécessaires à la gestion du service",
              "Centre d'hébergement sélectionné : accès aux données de séjour (hors données médicales élèves sauf accord explicite)",
              'Rectorat/DSDEN : accès aux dossiers de séjour soumis par les établissements',
              'Sous-traitants techniques : Railway (hébergement), Cloudflare R2 (stockage fichiers), Brevo (emails transactionnels) — tous engagés contractuellement au RGPD',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className={pCls}>
            Aucune donnée personnelle n&apos;est vendue, cédée ou louée à des tiers à des fins commerciales.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>4. Transferts hors Union Européenne</h2>
          <p className={pCls}>
            Railway Corp. (hébergeur) est une société américaine. Le transfert de données vers les États-Unis s&apos;effectue dans le cadre des clauses contractuelles types de la Commission européenne (CCT). Les serveurs Railway utilisés par LIAVO sont localisés en Europe de l&apos;Ouest (EU West).
          </p>
          <p className={pCls}>
            Cloudflare R2 (stockage fichiers) utilise des datacenters en Europe de l&apos;Ouest. Brevo (emails) est une société française.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>5. Sécurité des données</h2>
          <p className={pCls}>LIAVO met en œuvre les mesures techniques et organisationnelles suivantes :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Chiffrement des communications (HTTPS/TLS)',
              'Chiffrement des données financières sensibles (IBAN) en base de données',
              'Authentification par JWT avec expiration',
              'Accès aux données segmenté par rôle (RBAC)',
              'Stockage des fichiers sur Cloudflare R2 avec accès présigné temporaire',
              'Journalisation des accès et des modifications',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>6. Droits des personnes concernées</h2>
          <p className={pCls}>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              "Droit d'accès : obtenir une copie de vos données",
              'Droit de rectification : corriger des données inexactes',
              'Droit à l\'effacement ("droit à l\'oubli") : sous réserve des obligations légales',
              'Droit à la limitation du traitement',
              'Droit à la portabilité de vos données',
              "Droit d'opposition : pour les traitements basés sur l'intérêt légitime",
              'Droit de retrait du consentement : pour les traitements basés sur le consentement',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className={pCls}>
            Pour exercer vos droits, contactez <a href="mailto:contact@liavo.fr" className="text-[#1B4060] underline">contact@liavo.fr</a>. Réponse sous 30 jours.
          </p>
          <p className={pCls}>
            En cas de réclamation non résolue, vous pouvez saisir la CNIL :{' '}
            <a href="https://www.cnil.fr" className="text-[#1B4060] underline" target="_blank" rel="noopener noreferrer">cnil.fr</a>.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>7. Droits spécifiques aux mineurs</h2>
          <p className={pCls}>
            Les données des élèves mineurs sont traitées sur la base du consentement de leurs représentants légaux (parents ou tuteurs). Les parents peuvent exercer les droits d&apos;accès, rectification et effacement au nom de leur enfant en contactant <a href="mailto:contact@liavo.fr" className="text-[#1B4060] underline">contact@liavo.fr</a>.
          </p>
          <p className={pCls}>
            Les données médicales ne sont jamais partagées avec le centre d&apos;hébergement sans consentement explicite du parent, matérialisé par une case à cocher distincte dans le formulaire d&apos;autorisation.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>8. Cookies</h2>
          <p className={pCls}>LIAVO utilise uniquement des cookies strictement nécessaires au fonctionnement de la plateforme :</p>
          <ul className="list-disc list-inside space-y-1 mb-4 ml-2">
            {[
              'Cookie de session : maintien de la connexion (durée : session navigateur)',
              'Token JWT : authentification sécurisée (durée : 24h)',
            ].map(item => <li key={item} className={liCls}>{item}</li>)}
          </ul>
          <p className={pCls}>
            Aucun cookie publicitaire, analytique tiers ou de tracking n&apos;est utilisé. Aucun consentement cookie n&apos;est donc requis au sens de la directive ePrivacy pour ces cookies essentiels.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>9. Mise à jour de la politique</h2>
          <p className={pCls}>
            LIAVO peut mettre à jour la présente politique. La date de dernière mise à jour est indiquée en en-tête. Les modifications substantielles sont notifiées par email aux utilisateurs avec un préavis de 30 jours.
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
