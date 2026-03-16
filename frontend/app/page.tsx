'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Logo } from '@/app/components/Logo';

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

/* ─── Couleurs — tokens LIAVO (voir globals.css) ─────────────────────────── */

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
            <Logo size="md" variant="light" showTagline={false} />
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#etablissements" className="hover:text-[var(--color-primary)] transition-colors">Pour les établissements</a>
            <a href="#hebergeurs" className="hover:text-[var(--color-primary)] transition-colors">Pour les hébergeurs</a>
            <a href="#workflow" className="hover:text-[var(--color-primary)] transition-colors">Comment ça marche</a>
          </nav>

          {/* Boutons */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex items-center rounded-lg border border-[var(--color-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors">
              Se connecter
            </Link>
            <Link href="/register" className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors">
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
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary)]/[0.04] via-white to-white" />
          <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-[var(--color-accent)]/[0.06] to-transparent blur-3xl" />
          <div className="absolute top-20 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[var(--color-primary)]/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-4 py-1.5 mb-8">
              <svg className="h-4 w-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm font-semibold text-[var(--color-accent)]">Agréé Éducation Nationale</span>
            </div>
          </FadeIn>

          {/* Titre */}
          <FadeIn>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-[var(--color-primary)] leading-[1.1]">
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
              <Link href="/register?type=teacher" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[var(--color-accent)]/25 hover:opacity-90 transition-all hover:shadow-[var(--color-accent)]/40">
                Je suis un établissement scolaire
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link href="/register?type=venue" className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--color-border-strong)] px-8 py-3.5 text-base font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors">
                Je suis un hébergeur
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </FadeIn>

          {/* Social proof */}
          <FadeIn>
            <div className="mt-12 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                649 centres d&apos;hébergement agréés EN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                Conforme RGPD
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
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
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)] tracking-tight">
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
              <svg className="h-8 w-8 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              <span className="text-lg font-bold text-[var(--color-accent)]">Avec Liavo :</span>
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
                <div className="bg-white rounded-2xl border border-[var(--color-accent)]/20 p-6 shadow-sm h-full">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 mb-4">
                    <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)] tracking-tight">
              Une plateforme, deux univers
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="hebergeurs">
            {/* Colonne Établissement */}
            <FadeIn>
              <div className="bg-[var(--color-primary)] rounded-3xl p-8 sm:p-10 text-white h-full flex flex-col">
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
                      <svg className="h-5 w-5 text-[var(--color-accent)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-white/90 transition-colors">
                  Créer un compte établissement — Gratuit
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </Link>
              </div>
            </FadeIn>

            {/* Colonne Hébergeur */}
            <FadeIn>
              <div className="bg-[var(--color-accent)] rounded-3xl p-8 sm:p-10 text-white h-full flex flex-col">
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
                <Link href="/register/venue" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-white/90 transition-colors">
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
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)] tracking-tight">
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
                  <div className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/5 text-xs font-bold text-[var(--color-primary)]">
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
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)] tracking-tight">
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
                  <h3 className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-wider mb-2">{card.title}</h3>
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
      <section className="py-20 sm:py-28 bg-[var(--color-primary)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Prêt à simplifier vos prochains séjours ?
            </h2>
            <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
              Rejoignez les établissements et hébergeurs qui ont déjà digitalisé leur organisation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[var(--color-primary)] shadow-lg hover:bg-white/90 transition-colors">
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
      <footer className="bg-[var(--color-primary)] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            {/* Logo */}
            <Logo size="md" variant="dark" showTagline={true} />
            {/* Liens */}
            <div className="flex items-center gap-6 text-sm text-white/50">
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-xs text-white/30">
              © 2026 Liavo — Plateforme agréée Éducation Nationale
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
