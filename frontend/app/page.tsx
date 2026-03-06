'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/* ─── Fade-in au scroll ───────────────────────────────────────────────────── */

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('opacity-100', 'translate-y-0'); el.classList.remove('opacity-0', 'translate-y-6'); } },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useFadeIn();
  return <div ref={ref} className={`opacity-0 translate-y-6 transition-all duration-700 ease-out ${className}`}>{children}</div>;
}

/* ─── Couleurs ────────────────────────────────────────────────────────────── */
// Bleu marine : #1e3a5f  →  bg-[#1e3a5f] text-[#1e3a5f]
// Vert éducation : #2d8a4e  →  bg-[#2d8a4e] text-[#2d8a4e]

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — HEADER FIXE
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="fixed inset-x-0 top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f] shadow-sm">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[#1e3a5f] tracking-tight">Séjour Jeunesse</span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#etablissements" className="hover:text-[#1e3a5f] transition-colors">Pour les établissements</a>
            <a href="#hebergeurs" className="hover:text-[#1e3a5f] transition-colors">Pour les hébergeurs</a>
            <a href="#workflow" className="hover:text-[#1e3a5f] transition-colors">Comment ça marche</a>
          </nav>

          {/* Boutons */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex items-center rounded-lg border border-[#1e3a5f] px-4 py-2 text-sm font-semibold text-[#1e3a5f] hover:bg-[#1e3a5f]/5 transition-colors">
              Se connecter
            </Link>
            <Link href="/register" className="inline-flex items-center rounded-lg bg-[#2d8a4e] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#246f3f] transition-colors">
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1e3a5f]/[0.04] via-white to-white" />
          <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-[#2d8a4e]/[0.06] to-transparent blur-3xl" />
          <div className="absolute top-20 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#1e3a5f]/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2d8a4e]/10 border border-[#2d8a4e]/20 px-4 py-1.5 mb-8">
              <svg className="h-4 w-4 text-[#2d8a4e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-semibold text-[#2d8a4e]">Agréé Éducation Nationale</span>
            </div>
          </FadeIn>

          {/* Titre */}
          <FadeIn>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-[#1e3a5f] leading-[1.1]">
              La plateforme qui digitalise l&apos;organisation des séjours scolaires
            </h1>
          </FadeIn>

          {/* Sous-titre */}
          <FadeIn>
            <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              De la demande de devis à la signature parentale, en passant par la validation rectorat — tout en un seul endroit, 100% dématérialisé.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register?type=teacher" className="inline-flex items-center gap-2 rounded-xl bg-[#2d8a4e] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2d8a4e]/25 hover:bg-[#246f3f] transition-all hover:shadow-[#2d8a4e]/40">
                Je suis un établissement scolaire
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link href="/register?type=venue" className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1e3a5f] px-8 py-3.5 text-base font-semibold text-[#1e3a5f] hover:bg-[#1e3a5f]/5 transition-colors">
                Je suis un hébergeur
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </FadeIn>

          {/* Social proof */}
          <FadeIn>
            <div className="mt-12 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2d8a4e]" />
                649 centres d&apos;hébergement agréés EN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2d8a4e]" />
                Conforme RGPD
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2d8a4e]" />
                Intégration Chorus Pro
              </span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — PROBLÈME / SOLUTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] tracking-tight">
              Organiser un séjour scolaire aujourd&apos;hui, c&apos;est...
            </h2>
          </FadeIn>

          {/* Douleurs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              'Des semaines de mails avec les hébergeurs pour obtenir des devis',
              'Des autorisations parentales perdues, oubliées, relancées manuellement',
              'Des dossiers rectorat en PDF à remplir à la main',
            ].map((text, i) => (
              <FadeIn key={i}>
                <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm h-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 mb-4">
                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">{text}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Flèche */}
          <FadeIn className="text-center mb-12">
            <div className="inline-flex flex-col items-center gap-2">
              <svg className="h-8 w-8 text-[#2d8a4e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              <span className="text-lg font-bold text-[#2d8a4e]">Avec Séjour Jeunesse :</span>
            </div>
          </FadeIn>

          {/* Solutions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              'Devis reçus en 48h de tous les centres agréés de votre région',
              'Autorisations signées électroniquement, relances automatiques',
              'Dossier rectorat généré automatiquement, Chorus Pro intégré',
            ].map((text, i) => (
              <FadeIn key={i}>
                <div className="bg-white rounded-2xl border border-[#2d8a4e]/20 p-6 shadow-sm h-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2d8a4e]/10 mb-4">
                    <svg className="h-5 w-5 text-[#2d8a4e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">{text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — POUR QUI ? (2 colonnes)
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28" id="etablissements">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] tracking-tight">
              Une plateforme, deux univers
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="hebergeurs">
            {/* Colonne Établissement */}
            <FadeIn>
              <div className="bg-[#1e3a5f] rounded-3xl p-8 sm:p-10 text-white h-full flex flex-col">
                <div className="text-3xl mb-4">🏫</div>
                <h3 className="text-xl font-bold mb-1">Vous êtes un établissement scolaire ?</h3>
                <p className="text-white/60 text-sm mb-6">Enseignant, directeur ou gestionnaire</p>
                <ul className="space-y-3 flex-1">
                  {[
                    'Trouvez le centre agréé idéal parmi 649 référencés',
                    'Recevez et comparez les devis en un clic',
                    'Faites valider le séjour par votre directeur et le rectorat',
                    'Envoyez les autorisations parentales numériques',
                    'Suivez les inscriptions et paiements en temps réel',
                    'Générez automatiquement les ordres de mission accompagnateurs',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                      <svg className="h-5 w-5 text-[#2d8a4e] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1e3a5f] hover:bg-white/90 transition-colors">
                  Créer un compte établissement — Gratuit
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </Link>
              </div>
            </FadeIn>

            {/* Colonne Hébergeur */}
            <FadeIn>
              <div className="bg-[#2d8a4e] rounded-3xl p-8 sm:p-10 text-white h-full flex flex-col">
                <div className="text-3xl mb-4">🏡</div>
                <h3 className="text-xl font-bold mb-1">Vous êtes un centre d&apos;hébergement ?</h3>
                <p className="text-white/60 text-sm mb-6">Chalet, centre de vacances, auberge de jeunesse...</p>
                <ul className="space-y-3 flex-1">
                  {[
                    'Recevez des demandes de séjours qualifiées directement',
                    'Créez vos devis professionnels HT/TTC en quelques minutes',
                    'Gérez vos disponibilités et votre calendrier',
                    'Émettez vos factures et acomptes automatiquement',
                    'Intégration Chorus Pro pour facturer les établissements publics',
                    'Espace collaboratif avec l\'enseignant organisateur',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                      <svg className="h-5 w-5 text-white shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register/venue" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#2d8a4e] hover:bg-white/90 transition-colors">
                  Référencer mon centre — 1er mois gratuit
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 — WORKFLOW (6 étapes)
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white" id="workflow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] tracking-tight">
              De l&apos;idée au séjour en 6 étapes
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { num: '1', icon: '📝', title: 'Création du projet', desc: 'L\'enseignant définit la destination, les dates et les objectifs pédagogiques du séjour.' },
              { num: '2', icon: '🏡', title: 'Réception des devis', desc: 'Les centres agréés de la région reçoivent la demande et envoient leurs devis sous 48h.' },
              { num: '3', icon: '✅', title: 'Validation directeur', desc: 'Le directeur d\'établissement compare les offres, sélectionne le devis et approuve le séjour.' },
              { num: '4', icon: '🏛️', title: 'Dossier rectorat', desc: 'Le dossier complet est envoyé automatiquement au rectorat pour validation réglementaire.' },
              { num: '5', icon: '👨‍👩‍👧', title: 'Signatures & paiements', desc: 'Les parents signent l\'autorisation en ligne et règlent en 1 à 10 fois sans frais.' },
              { num: '6', icon: '🎒', title: 'Le séjour a lieu', desc: 'L\'espace collaboratif relie tous les acteurs : enseignant, hébergeur, accompagnateurs.' },
            ].map((step, i) => (
              <FadeIn key={i}>
                <div className="relative bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#1e3a5f]/5 text-xs font-bold text-[#1e3a5f]">
                    {step.num}
                  </div>
                  <div className="text-2xl mb-3">{step.icon}</div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 6 — RÉASSURANCE
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] tracking-tight">
              Conçu pour et avec l&apos;Éducation Nationale
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🔒', title: '100% RGPD', desc: 'Données hébergées en France, conformes CNIL et réglementations européennes.' },
              { icon: '🏛️', title: 'Chorus Pro', desc: 'Facturation électronique intégrée vers les établissements publics.' },
              { icon: '🎓', title: 'Agréments vérifiés', desc: 'Tous les centres sont vérifiés et agréés par l\'Éducation Nationale.' },
              { icon: '📱', title: 'Zéro installation', desc: 'Accessible depuis n\'importe quel navigateur, ordinateur ou mobile.' },
            ].map((card, i) => (
              <FadeIn key={i}>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center h-full">
                  <div className="text-3xl mb-4">{card.icon}</div>
                  <h3 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wider mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 7 — CTA FINAL
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-[#1e3a5f]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Prêt à simplifier vos prochains séjours ?
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
              Rejoignez les établissements et hébergeurs qui ont déjà digitalisé leur organisation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#1e3a5f] shadow-lg hover:bg-white/90 transition-colors">
                Créer un compte établissement
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link href="/register/venue" className="inline-flex items-center gap-2 rounded-xl border-2 border-white px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
                Référencer mon centre
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#162d4a] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-semibold text-white">Séjour Jeunesse</span>
            </div>
            {/* Liens */}
            <div className="flex items-center gap-6 text-sm text-white/50">
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-white/30">
              © 2026 Séjour Jeunesse — Plateforme agréée Éducation Nationale
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
