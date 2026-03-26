import Link from 'next/link';

export const metadata = {
  title: 'Mentions légales — LIAVO',
  description: 'Mentions légales de la plateforme LIAVO',
};

export default function MentionsLegalesPage() {
  const sectionCls = 'mb-10';
  const h2Cls = 'text-lg font-bold text-[#1B4060] mb-3 border-b border-gray-200 pb-2';
  const pCls = 'text-sm text-gray-700 leading-relaxed mb-3';
  const blockCls = 'rounded-lg border border-gray-200 bg-gray-50 p-4';

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
    <h1 className="text-2xl font-bold text-gray-900 mb-2">Mentions légales</h1>
    <p className="text-sm text-gray-500">En vigueur depuis mars 2026</p>
  </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>1. Éditeur du site</h2>
          <div className={blockCls}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Dénomination sociale', 'LIAVO'],
                  ['Forme juridique', 'Société par actions simplifiée unipersonnelle (SASU)'],
                  ['Capital social', '1 000 Euros'],
                  ['Siège social', '472 route du Mas Devant, 74440 MORILLON'],
                  ['RCS', 'ANNECY — SIRET : [à compléter après immatriculation]'],
                  ['Directeur de la publication', 'Théo ROCHE-LOISON, Président'],
                  ['Email de contact', 'contact@liavo.fr'],
                  ['Site web', 'https://liavo.fr'],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-600 w-1/2">{label}</td>
                    <td className="py-2 text-gray-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>2. Hébergeur du site</h2>
          <div className={blockCls}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Société', 'Railway Corp.'],
                  ['Adresse', '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis'],
                  ['Site web', 'https://railway.com'],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-gray-600 w-1/2">{label}</td>
                    <td className="py-2 text-gray-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`${pCls} mt-3`}>
            Les fichiers sont stockés sur l&apos;infrastructure Cloudflare R2 (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis), dans des datacenters en Europe de l&apos;Ouest.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>3. Propriété intellectuelle</h2>
          <p className={pCls}>
            L&apos;ensemble des contenus présents sur liavo.fr (textes, graphismes, logotypes, code source) sont la propriété exclusive de LIAVO SASU et protégés par le droit d&apos;auteur.
          </p>
          <p className={pCls}>
            La marque LIAVO est déposée à l&apos;INPI en classes 35, 38 et 42. Toute reproduction non autorisée constitue une contrefaçon.
          </p>
          <p className={pCls}>
            La base des centres d&apos;hébergement est issue de l&apos;API officielle du Ministère de l&apos;Éducation Nationale (data.education.gouv.fr), sous licence ouverte Etalab.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>4. Données personnelles</h2>
          <p className={pCls}>
            LIAVO SASU traite des données personnelles en qualité de responsable de traitement et, pour le compte des établissements scolaires, en qualité de sous-traitant au sens du RGPD.
          </p>
          <p className={pCls}>
            Consultez notre{' '}
            <Link href="/legal/confidentialite" className="text-[#1B4060] underline">politique de confidentialité</Link>{' '}
            ou contactez <a href="mailto:contact@liavo.fr" className="text-[#1B4060] underline">contact@liavo.fr</a>.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>5. Cookies</h2>
          <p className={pCls}>
            Le site utilise uniquement des cookies strictement nécessaires au fonctionnement (authentification, session). Aucun cookie publicitaire ou de tracking tiers n&apos;est déposé.
          </p>
        </div>

        <div className={sectionCls}>
          <h2 className={h2Cls}>6. Droit applicable</h2>
          <p className={pCls}>
            Les présentes mentions légales sont régies par le droit français. Tout litige relève de la compétence exclusive des tribunaux du ressort de la Cour d&apos;appel d&apos;Annecy.
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
