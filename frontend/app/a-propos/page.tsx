import Link from 'next/link';

export const metadata = {
  title: 'À propos — LIAVO',
  description: 'LIAVO est une plateforme française conçue par des hébergeurs, pour des hébergeurs. Découvrez notre histoire et notre mission.',
};

export default function AProposPage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';

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
              <p className="text-xs text-gray-500">SASU — 472 route du Mas Devant, 74440 MORILLON — 102 994 910 RCS Annecy</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">À propos de LIAVO</h1>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>Notre mission</h2>
          <p className={pCls}>
            LIAVO est né d&apos;un constat simple : organiser un séjour scolaire ou une colonie de vacances
            mobilise des dizaines d&apos;emails, de tableaux Excel et de documents éparpillés entre l&apos;hébergeur,
            l&apos;enseignant, la direction et les familles. Notre objectif est de réunir tous ces acteurs dans un
            seul outil, pour que les organisateurs passent moins de temps à gérer et plus de temps à emmener
            les jeunes dehors — loin des écrans et de la sédentarité.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>Fait en France, par des professionnels du terrain</h2>
          <p className={pCls}>
            LIAVO est développé et hébergé intégralement en France. Les données de vos séjours,
            de vos élèves et de vos familles ne quittent jamais le territoire français.
          </p>
          <p className={pCls}>
            La plateforme est conçue par Théo Roche-Loison, entrepreneur savoyard, titulaire du BAFA,
            ancien animateur et gérant du Chalet Le Sauvageon à Morillon (Haute-Savoie) — premier
            hébergement référencé et premier compte production de la plateforme.
          </p>
          <p className={pCls}>
            Connaître le terrain de l&apos;intérieur, c&apos;est ce qui nous permet de construire un outil qui
            correspond vraiment aux besoins des hébergeurs, des enseignants et des organisateurs de colos.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>Pourquoi LIAVO ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <svg className="h-8 w-8 text-[#1B4060] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-8 4 3 4-5 6 10H3" />
              </svg>
              <h3 className="text-sm font-bold text-[#1B4060] mb-2">Né du terrain</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Créé par un hébergeur qui organise des séjours depuis 7 ans. Chaque fonctionnalité
                répond à un vrai problème vécu.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <svg className="h-8 w-8 text-[#1B4060] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-sm font-bold text-[#1B4060] mb-2">Données protégées</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Hébergement Scalingo Paris, stockage OVH Gravelines, emails Brevo France.
                Aucun prestataire hors Union Européenne. Conforme RGPD.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <svg className="h-8 w-8 text-[#1B4060] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-sm font-bold text-[#1B4060] mb-2">Pour tous les acteurs</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Hébergeurs, enseignants, directeurs, rectorat, familles. Un seul outil qui connecte
                tous les intervenants d&apos;un séjour, de la demande de devis à la facturation finale.
              </p>
            </div>
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>Contact</h2>
          <p className={pCls}>Une question, une démo, un partenariat ?</p>
          <p className={pCls}>
            Email :{' '}
            <a href="mailto:contact@liavo.fr" className="text-[#C87D2E] underline font-medium">
              contact@liavo.fr
            </a>
          </p>
          <p className={pCls}>
            Adresse : LIAVO SASU — 472 route du Mas Devant, 74440 Morillon, Haute-Savoie
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <Link href="/legal/mentions-legales" className="text-[#1B4060] underline">Mentions légales</Link>
          <Link href="/legal/cgu" className="text-[#1B4060] underline">CGU</Link>
          <Link href="/legal/cgv-hebergeurs" className="text-[#1B4060] underline">CGV Hébergeurs</Link>
          <Link href="/legal/confidentialite" className="text-[#1B4060] underline">Confidentialité</Link>
          <Link href="/" className="text-gray-500 underline">Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  );
}
