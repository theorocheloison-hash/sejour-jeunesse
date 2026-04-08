import Link from 'next/link';

export const metadata = {
  title: 'Mandat de Facturation — LIAVO',
  description: 'Mandat de facturation Chorus Pro — Émission de factures électroniques',
};

export default function MandatFacturationPage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';
  const liCls = 'text-sm text-gray-700 leading-relaxed';
  const blockCls = 'rounded-lg border border-gray-200 bg-gray-50 p-4';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* ── En-tête ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#1B4060] flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div>
              <span className="text-lg font-bold text-[#1B4060]">Liavo</span>
              <p className="text-xs text-gray-500">SASU — 472 route du Mas Devant, 74440 MORILLON — 102 994 910 RCS Annecy</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mandat de Facturation</h1>
          <p className="text-sm text-gray-500 mb-3">Émission de factures électroniques au format Chorus Pro</p>
          <span className="inline-flex items-center rounded-full bg-[#1B4060]/10 px-3 py-1 text-xs font-semibold text-[#1B4060]">
            Version 1.1 — Mars 2026
          </span>
        </div>

        {/* ── ARTICLE 1 — PARTIES ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 1 — PARTIES</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className={blockCls}>
              <p className="text-xs font-semibold text-[#1B4060] uppercase tracking-wide mb-2">Mandataire</p>
              <p className={liCls}><strong>LIAVO</strong>, SASU au capital de 1 000 €</p>
              <p className={liCls}>Siège : 472 route du Mas Devant, 74440 MORILLON</p>
              <p className={liCls}>SIRET : 102 994 910 00010 — RCS Annecy</p>
              <p className={liCls}>102 994 910 RCS Annecy</p>
              <p className={liCls}>Qualité : Plateforme SaaS éditrice — agit comme émetteur technique</p>
            </div>
            <div className={blockCls}>
              <p className="text-xs font-semibold text-[#1B4060] uppercase tracking-wide mb-2">Mandant</p>
              <p className={liCls}>L&apos;hébergeur titulaire du compte LIAVO</p>
              <p className={liCls}>Qualité : Centre d&apos;hébergement agréé, fournisseur effectif des prestations</p>
              <p className={liCls}>Identification : SIRET et raison sociale renseignés dans le profil LIAVO</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 italic">
            L&apos;acceptation du présent mandat par l&apos;Hébergeur vaut signature électronique conformément à l&apos;article 1366 du Code civil.
          </p>
        </section>

        {/* ── ARTICLE 2 — OBJET DU MANDAT ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 2 — OBJET DU MANDAT</h2>
          <p className={pCls}>
            Par le présent mandat, l&apos;Hébergeur autorise expressément LIAVO à émettre en son nom et pour son compte des factures électroniques à destination des établissements scolaires publics, au format PEPPOL UBL 2.1 compatible Chorus Pro, conformément aux obligations de facturation électronique applicables aux marchés publics.
          </p>
          <p className={pCls}>Ce mandat couvre exclusivement :</p>
          <ul className="list-disc pl-5 mb-3 space-y-1">
            <li className={liCls}>Les factures d&apos;acompte émises après sélection d&apos;un devis par l&apos;établissement scolaire</li>
            <li className={liCls}>Les factures de solde émises après réalisation du séjour</li>
            <li className={liCls}>Tout document rectificatif (avoir) associé aux factures ci-dessus</li>
          </ul>
          <p className={pCls}>
            Le mandat ne couvre pas les factures établies hors plateforme LIAVO ni les prestations non liées aux séjours scolaires.
          </p>
        </section>

        {/* ── ARTICLE 3 — OBLIGATIONS DE L'HÉBERGEUR ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 3 — OBLIGATIONS DE L&apos;HÉBERGEUR</h2>

          <h3 className="text-sm font-semibold text-gray-800 mb-2">3.1 Exactitude des données</h3>
          <p className={pCls}>
            L&apos;Hébergeur est seul responsable de l&apos;exactitude et de la mise à jour des informations suivantes dans son profil LIAVO : Raison sociale, forme juridique, SIRET / Adresse du siège social / Numéro de TVA intracommunautaire / IBAN pour les virements / Numéro d&apos;agrément Éducation Nationale. Toute facture émise sur la base d&apos;informations inexactes engage la responsabilité exclusive de l&apos;Hébergeur.
          </p>

          <h3 className="text-sm font-semibold text-gray-800 mb-2">3.2 Contenu des devis</h3>
          <p className={pCls}>
            L&apos;Hébergeur valide le contenu de chaque devis avant soumission. En acceptant un devis sur la plateforme, l&apos;Hébergeur confirme que les montants HT, les taux de TVA et les conditions de facturation sont conformes à la réglementation fiscale applicable à son activité.
          </p>

          <h3 className="text-sm font-semibold text-gray-800 mb-2">3.3 Conservation</h3>
          <p className={pCls}>
            L&apos;Hébergeur est tenu de conserver chaque facture émise via LIAVO pendant une durée minimale de dix (10) ans (art. L. 123-22 du Code de commerce). LIAVO met ces documents à disposition pendant la durée d&apos;abonnement et six (6) mois après résiliation.
          </p>
        </section>

        {/* ── ARTICLE 4 — OBLIGATIONS DE LIAVO ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 4 — OBLIGATIONS DE LIAVO</h2>
          <p className={pCls}>LIAVO s&apos;engage à :</p>
          <ul className="list-disc pl-5 mb-3 space-y-1">
            <li className={liCls}>Émettre les factures dans un délai raisonnable après déclenchement par l&apos;Hébergeur</li>
            <li className={liCls}>Utiliser exclusivement les données transmises par l&apos;Hébergeur, sans modification du fond</li>
            <li className={liCls}>Générer des fichiers XML conformes au standard PEPPOL UBL 2.1 et aux spécifications Chorus Pro</li>
            <li className={liCls}>Conserver les preuves d&apos;émission (horodatage, identifiant de transaction Chorus Pro)</li>
            <li className={liCls}>Notifier l&apos;Hébergeur en cas de rejet par Chorus Pro dans les 48 heures</li>
          </ul>
          <p className={pCls}>
            LIAVO n&apos;intervient pas dans la relation contractuelle entre l&apos;Hébergeur et l&apos;établissement scolaire et ne peut être considéré comme cocontractant, débiteur ou créancier des sommes facturées.
          </p>
        </section>

        {/* ── ARTICLE 5 — LIMITATION DE RESPONSABILITÉ ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 5 — LIMITATION DE RESPONSABILITÉ</h2>
          <p className={pCls}>
            La responsabilité de LIAVO est expressément limitée aux dysfonctionnements techniques directement imputables à la plateforme, dans la limite des sommes versées au titre de l&apos;abonnement LIAVO au cours des douze (12) derniers mois.
          </p>
          <p className={pCls}>LIAVO ne saurait être tenu responsable :</p>
          <ul className="list-disc pl-5 mb-3 space-y-1">
            <li className={liCls}>Des rejets de factures par Chorus Pro résultant d&apos;informations erronées fournies par l&apos;Hébergeur</li>
            <li className={liCls}>Des défaillances ou indisponibilités de la plateforme Chorus Pro gérée par l&apos;AIFE</li>
            <li className={liCls}>Des litiges commerciaux entre l&apos;Hébergeur et l&apos;établissement scolaire</li>
            <li className={liCls}>Des conséquences fiscales d&apos;une TVA incorrectement appliquée par l&apos;Hébergeur</li>
            <li className={liCls}>En cas de force majeure (panne infrastructure, cyberattaque, décision administrative)</li>
          </ul>
        </section>

        {/* ── ARTICLE 6 — DURÉE ET RÉSILIATION ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 6 — DURÉE ET RÉSILIATION</h2>
          <p className={pCls}>
            Le présent mandat prend effet à la date d&apos;acceptation et est conclu pour la durée de l&apos;abonnement LIAVO en cours. Il est renouvelé automatiquement à chaque renouvellement. En cas de résiliation, le mandat prend fin à la date d&apos;effet. Les factures émises avant cette date restent valables.
          </p>
          <p className={pCls}>
            L&apos;Hébergeur peut révoquer le mandat à tout moment depuis ses paramètres LIAVO, avec effet immédiat. La révocation entraîne l&apos;impossibilité de générer de nouvelles factures Chorus Pro jusqu&apos;à acceptation d&apos;un nouveau mandat.
          </p>
        </section>

        {/* ── ARTICLE 7 — DONNÉES PERSONNELLES ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 7 — DONNÉES PERSONNELLES</h2>
          <p className={pCls}>
            Dans le cadre de l&apos;exécution du présent mandat, LIAVO traite les données personnelles de l&apos;Hébergeur (nom, SIRET, IBAN, email) en qualité de sous-traitant au sens du RGPD (UE) 2016/679. Ces données sont utilisées exclusivement pour l&apos;émission des factures et la gestion du mandat. L&apos;Hébergeur dispose d&apos;un droit d&apos;accès, de rectification et d&apos;effacement de ses données conformément à la politique de confidentialité LIAVO accessible sur liavo.fr.
          </p>
        </section>

        {/* ── ARTICLE 8 — LOI APPLICABLE ET JURIDICTION ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 8 — LOI APPLICABLE ET JURIDICTION</h2>
          <p className={pCls}>
            Le présent mandat est soumis au droit français. Tout litige relatif à son interprétation ou à son exécution sera soumis à la compétence exclusive du Tribunal de commerce d&apos;Annecy, sauf disposition légale impérative contraire.
          </p>
        </section>

        {/* ── ARTICLE 9 — MODALITÉS D'ACCEPTATION ── */}
        <section className={sectionCls}>
          <h2 className={h2Cls}>ARTICLE 9 — MODALITÉS D&apos;ACCEPTATION</h2>
          <p className={pCls}>
            Le présent mandat est accepté par l&apos;Hébergeur par voie électronique depuis son espace paramètres LIAVO, par clic sur le bouton « J&apos;accepte le mandat de facturation ».
          </p>
          <p className={pCls}>Métadonnées enregistrées lors de l&apos;acceptation :</p>
          <ul className="list-disc pl-5 mb-3 space-y-1">
            <li className={liCls}>Date et heure d&apos;acceptation (UTC)</li>
            <li className={liCls}>Version du mandat acceptée</li>
            <li className={liCls}>Adresse IP de connexion</li>
            <li className={liCls}>Identifiant unique du compte hébergeur</li>
          </ul>
          <p className={pCls}>
            Un email de confirmation est adressé à l&apos;Hébergeur immédiatement après acceptation. En cas de modification substantielle, les Hébergeurs seront notifiés par email et invités à accepter la nouvelle version.
          </p>
        </section>

        {/* ── Pied de page ── */}
        <div className="border-t border-gray-200 pt-6 mt-12">
          <p className="text-xs text-gray-400 italic mb-2">
            LIAVO SASU — 102 994 910 RCS Annecy — Mandat de Facturation — Version 1.1 — Mars 2026
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Ce document fait partie intégrante des Conditions Générales de Vente LIAVO.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B4060] hover:underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
