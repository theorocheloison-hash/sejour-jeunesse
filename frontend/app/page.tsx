'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/app/components/Logo';
import PricingTable from '@/app/components/PricingTable';
import './landing.css';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  // Nav scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal IntersectionObserver
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.liavo-landing .reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Cursor spotlight
  useEffect(() => {
    const cards = document.querySelectorAll(
      '.liavo-landing .feature, .liavo-landing .profil, .liavo-landing .comp, .liavo-landing .net-card, .liavo-landing .cat-card'
    );
    const cleanups: Array<() => void> = [];
    cards.forEach((card) => {
      const el = card as HTMLElement;
      const onMove = (e: Event) => {
        const me = e as MouseEvent;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((me.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((me.clientY - r.top) / r.height * 100) + '%');
      };
      const onLeave = () => {
        el.style.setProperty('--mx', '50%');
        el.style.setProperty('--my', '0%');
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Parallax hero dashboard
  useEffect(() => {
    const dash = document.querySelector('.liavo-landing .dashboard') as HTMLElement | null;
    const wrap = document.querySelector('.liavo-landing .hero-mockup-wrap') as HTMLElement | null;
    if (!dash || !wrap) return;
    let ticking = false;
    const update = () => {
      const r = wrap.getBoundingClientRect();
      const y = Math.max(-40, Math.min(40, (window.innerHeight - r.top) * -0.04));
      dash.style.transform = `translateY(${y.toFixed(1)}px)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="liavo-landing">

      {/* ── NAV ── */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <Logo size="sm" showTagline={false} />
          </Link>
          <div className="nav-links">
            <a href="#hebergeurs">Hébergeurs</a>
            <a href="#enseignants">Enseignants</a>
            <a href="#colonies">Colonies</a>
            <a href="#reseau">Réseaux</a>
            <Link href="/catalogue">Catalogue</Link>
            <a href="#pricing">Tarifs</a>
            <Link href="/a-propos">À propos</Link>
          </div>
          <div className="nav-cta">
            <Link className="btn btn-ghost" href="/login">Se connecter</Link>
            <Link className="btn btn-primary" href="/register?type=hebergeur">
              Commencer gratuitement <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="wrap">
          <div className="hero-content">
            <h1>
              La plateforme de coordination<br />
              <span className="accent">des séjours jeunesse</span>.
            </h1>
            <p className="hero-sub">
              Hébergeurs, enseignants, organisateurs — LIAVO gère tout le flux administratif, du devis à la convention signée, en un seul outil.
            </p>
            <div className="hero-dossier reveal" data-delay="1">
              <div className="dossier-row">
                {[
                  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Demande', delay: 0 },
                  { icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z', label: 'Devis', delay: 1 },
                  { icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Convention signée', delay: 2 },
                ].map((step, i, arr) => (
                  <div key={step.label} className="dossier-step-wrap">
                    <div className="dossier-step" style={{ '--step-delay': step.delay } as React.CSSProperties}>
                      <div className="dossier-icon">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d={step.icon} />
                        </svg>
                      </div>
                      <span className="dossier-label">{step.label}</span>
                      <div className="dossier-check" style={{ '--check-delay': step.delay } as React.CSSProperties}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="dossier-connector" style={{ '--connector-delay': step.delay } as React.CSSProperties} />
                    )}
                  </div>
                ))}
              </div>
              <div className="dossier-row">
                {[
                  { icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Journal familles', delay: 3 },
                  { icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', label: 'Facture', delay: 4 },
                ].map((step, i, arr) => (
                  <div key={step.label} className="dossier-step-wrap">
                    <div className="dossier-step" style={{ '--step-delay': step.delay } as React.CSSProperties}>
                      <div className="dossier-icon">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d={step.icon} />
                        </svg>
                      </div>
                      <span className="dossier-label">{step.label}</span>
                      <div className="dossier-check" style={{ '--check-delay': step.delay } as React.CSSProperties}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="dossier-connector" style={{ '--connector-delay': step.delay } as React.CSSProperties} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-trust reveal" data-delay="1">
              {[
                {
                  icon: 'M3 17l6-8 4 3 4-5 6 10H3',
                  title: 'Né du terrain',
                  desc: 'Créé par un hébergeur qui organise des séjours depuis 7 ans.',
                },
                {
                  icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
                  title: 'Données en France',
                  desc: 'Hébergement Scalingo Paris, OVH Gravelines. Conforme RGPD.',
                },
                {
                  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
                  title: 'Pour tous les acteurs',
                  desc: 'Hébergeurs, enseignants, organisateurs de colos, directions d\'établissement, familles.',
                },
              ].map((item) => (
                <div key={item.title} className="hero-trust-item">
                  <div className="hero-trust-icon">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className="hero-trust-title">{item.title}</div>
                    <div className="hero-trust-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── PROFILS ── */}
      <section className="profils" id="profils">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">pour qui ?</span>
            <h2 className="section-title">
              Trois métiers,<br /><span className="accent">un seul outil</span>.
            </h2>
            <p className="section-lead">
              Hébergeurs, enseignants, organisateurs de colos — chacun trouve dans LIAVO l&apos;espace qui lui correspond.
            </p>
          </div>
          <div className="profils-grid">
            <a href="#hebergeurs" className="profil reveal" data-delay="1">
              <span className="badge payant">30 jours d&apos;essai</span>
              <span className="icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-7h6v7" /><path d="M3 21h18" />
                </svg>
              </span>
              <h3>Hébergeur et centre de vacances</h3>
              <p>
                Vous gérez un ou plusieurs centres — gîte, domaine, chalet, auberge de jeunesse, centre municipal.
                LIAVO centralise devis, planning, CRM et facturation pour toute votre structure, quel que soit le nombre de sites.
              </p>
              <span className="profil-link">Découvrir <span className="arrow">→</span></span>
            </a>
            <a href="#enseignants" className="profil reveal" data-delay="2">
              <span className="badge gratuit">Offert</span>
              <span className="icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" /><path d="M22 10v6" />
                </svg>
              </span>
              <h3>Enseignants</h3>
              <p>Vous organisez un séjour pour votre classe — classe verte, voyage scolaire, classe de neige.</p>
              <span className="profil-link">Découvrir <span className="arrow">→</span></span>
            </a>
            <a href="#colonies" className="profil reveal" data-delay="3">
              <span className="badge gratuit">Offert</span>
              <span className="icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21l9-16 9 16z" /><path d="M9 21l3-7 3 7" /><path d="M3 21h18" />
                </svg>
              </span>
              <h3>Organisateurs de colonies</h3>
              <p>
                Vous organisez des camps d&apos;été, séjours de vacances ou centres de loisirs
                (mairies, associations, comités d&apos;entreprise).
              </p>
              <span className="profil-link">Découvrir <span className="arrow">→</span></span>
            </a>
          </div>
        </div>
      </section>

      {/* ── HÉBERGEURS ── */}
      <section className="persona-section" id="hebergeurs">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="tag-persona">Pour les hébergeurs</span>
            <span className="eyebrow">solution complète · payante</span>
            <h2 className="section-title">
              Tous vos types de séjours,<br />dans un <span className="accent">seul outil</span>.
            </h2>
            <p className="section-lead">
              Recevez les demandes — séjours collectifs scolaires, colos, ALSH, groupes — créez vos devis depuis
              votre catalogue, pilotez planning collaboratif et CRM clients, suivez chaque dossier de A à Z.
            </p>
          </div>
          <div className="features">
            {[
              { n: '01', t: 'Un compte, plusieurs centres', d: 'Que vous gériez un seul gîte ou une association avec dix hébergements, LIAVO regroupe tout sous une seule organisation. Chaque centre a son propre profil et ses propres séjours.', icon: 'M3 21h18M3 21V9l9-6 9 6v12M9 21v-7h6v7' },
              { n: '02', t: 'Dashboard collaboratif par séjour', d: "Pour chaque séjour collectif réservé, un espace partagé avec l'enseignant ou l'organisateur : messagerie, planning, participants, documents. Visibilité temps réel sur chaque dossier.", icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z' },
              { n: '03', t: 'Planning drag & drop', d: 'Organisez la semaine en glisser-déposer. Les groupes tournent automatiquement sur les activités. Export PDF A4 paysage pour l\'impression.', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { n: '04', t: 'CRM clients intégré', d: 'Gérez vos établissements scolaires et organisateurs récurrents, suivez l\'historique de chaque client, relancez en un clic.', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { n: '05', t: 'Documents administratifs du centre', d: 'Centralisez vos documents réglementaires (agrément Éducation Nationale, RC Pro, attestations) avec suivi de date d\'expiration. L\'organisateur y accède directement depuis l\'espace collaboratif sans avoir à les redemander à chaque séjour.', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
              { n: '06', t: 'Facturation Chorus Pro intégrée', d: 'Facturez les établissements publics au format XML UBL 2.1, sans démarche supplémentaire. Conforme aux exigences de la facturation électronique.', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String((i % 5) + 1)}>
                <span className="num">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div className="hero-mockup-wrap reveal">
            <img
              src="https://liavo-uploads.s3.gra.io.cloud.ovh.net/Dashboard%20_Hebergeur_Liavo.png"
              alt="Dashboard hébergeur LIAVO"
              style={{ width: '100%', borderRadius: '16px 16px 0 0', display: 'block', boxShadow: 'var(--shadow-lg)' }}
            />
          </div>

          <div className="ps-cta reveal">
            <a className="btn btn-primary btn-lg" href="#pricing">Commencer 30 jours d&apos;essai <span className="arrow">→</span></a>
          </div>
        </div>
      </section>

      {/* ── ENSEIGNANTS ── */}
      <section className="persona-section alt" id="enseignants">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="tag-persona free">Pour les enseignants</span>
            <span className="eyebrow">gratuit, toujours</span>
            <h2 className="section-title">
              Votre séjour scolaire,<br /><span className="accent">sans la paperasse</span>.
            </h2>
            <p className="section-lead">
              De l&apos;appel d&apos;offres à la signature de la convention, LIAVO automatise tout le flux administratif.
              Gratuit, toujours.
            </p>
          </div>
          <div className="features">
            {[
              { n: '01', t: "Appel d'offres en quelques minutes", d: "Décrivez votre projet (destination, dates, nombre d'élèves), les centres répondent directement avec leurs devis. Comparez sans relancer par email.", icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { n: '02', t: 'Signature électronique de la convention', d: "Le directeur d'école ou chef d'établissement signe la convention en ligne. LIAVO génère le dossier de déclaration que l'enseignant transmet lui-même à l'autorité académique compétente (IEN de circonscription pour le 1er degré, rectorat pour le 2nd degré).", icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
              { n: '03', t: 'Autorisations parentales numériques', d: 'Importez votre liste d\'élèves depuis Pronote ou ONDE en CSV. Les parents signent en ligne (fiche sanitaire, régime alimentaire, paiement échelonné).', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
              { n: '04', t: 'Espace collaboratif avec l\'hébergeur et les familles', d: 'Planning, messagerie, documents et journal de séjour. Les familles suivent le séjour en temps réel via un lien web, sans application.', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String(i + 1)}>
                <span className="num">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
          <div className="ps-cta reveal">
            <Link className="btn btn-primary btn-lg" href="/appel-offres">
              Créer mon premier séjour <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── COLONIES ── */}
      <section className="persona-section dark" id="colonies">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="tag-persona free">Pour les organisateurs de colos</span>
            <span className="eyebrow">gratuit, toujours</span>
            <h2 className="section-title">
              Organisez vos colonies<br />en toute <span className="accent">sérénité</span>.
            </h2>
            <p className="section-lead">
              Pour les associations, mairies, comités d&apos;entreprise et centres de loisirs.
              Trouvez le centre, gérez les inscriptions, suivez le séjour en direct.
            </p>
          </div>
          <div className="features cols-3">
            {[
              { n: '01', t: 'Recherche d\'hébergeur géolocalisée', d: 'Lancez votre demande dans la zone qui vous intéresse, recevez des devis qualifiés des centres disponibles à vos dates.', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
              { n: '02', t: 'Planning d\'activités drag & drop', d: 'Construisez le programme de la colo semaine par semaine. Glissez-déposez les activités, gérez les groupes et les rotations, exportez le planning en PDF pour les animateurs.', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 012-2h2a2 2 0 012 2m0 0V7a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2' },
              { n: '03', t: 'Espace collaboratif avec l\'hébergeur', d: 'Messagerie, documents, participants et autorisations parentales. Tout partagé avec le centre d\'hébergement depuis un espace commun.', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
              { n: '04', t: 'Journal de séjour pour les familles', d: 'Les parents reçoivent un journal de séjour pendant les vacances : photos, planning du jour, nouvelles. Pas d\'application à installer.', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { n: '05', t: 'Déclaration TAM simplifiée', d: 'Préparez le dossier de déclaration auprès du SDJES depuis les données du séjour. Téléchargez le dossier complet, prêt à transmettre.', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String((i % 5) + 1)}>
                <span className="num">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
          <div className="ps-cta reveal">
            <Link className="btn btn-primary btn-lg" href="/appel-offres">
              Créer mon premier séjour <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── COLLABORATIF ── */}
      <section className="persona-section dark" id="collaboratif">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">espace collaboratif</span>
            <h2 className="section-title">
              Toutes les parties prenantes<br />dans un <span className="accent">seul espace</span>.
            </h2>
            <p className="section-lead">
              Pour chaque séjour réservé, un espace partagé réunit hébergeur, enseignant ou organisateur,
              directeur d&apos;établissement et familles. Premier outil du marché à centraliser toute la
              coordination d&apos;un séjour collectif.
            </p>
          </div>
          <div className="actors-flow reveal" style={{ marginBottom: '40px' }}>
            {[
              'Hébergeur',
              'Enseignant / Organisateur',
              'Directeur / Signataire',
              'Autorité (rectorat / SDJES)',
              'Familles',
            ].map((label, i, arr) => (
              <div key={label} className="actor-step">
                <div className="actor-node">
                  <span className="actor-dot" />
                  <span className="actor-label">{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className="actor-connector" style={{ '--line-index': i } as React.CSSProperties}>
                    <svg width="40" height="2" viewBox="0 0 40 2" fill="none">
                      <line x1="0" y1="1" x2="40" y2="1" stroke="rgba(200,125,46,0.25)" strokeWidth="1.5" />
                      <line className="actor-line-animated" x1="0" y1="1" x2="40" y2="1"
                        stroke="#C87D2E" strokeWidth="1.5" strokeDasharray="40" strokeDashoffset="40" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="features cols-3">
            {[
              { n: '01', t: 'Messagerie et documents centralisés', d: 'Fini les chaînes d\'emails et les fichiers Word partagés en drive. Toutes les conversations et tous les documents du séjour au même endroit, accessibles à chaque partie prenante avec les bons droits.', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z' },
              { n: '02', t: 'Planning temps réel', d: 'Drag & drop collaboratif, visible par toutes les parties prenantes. Modifications instantanées, export PDF A4 paysage prêt à imprimer pour les encadrants.', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 012-2h2a2 2 0 012 2m0 0V7a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2' },
              { n: '03', t: 'Journal de séjour pour les familles', d: 'Photos, planning du jour, nouvelles depuis le terrain. Les familles suivent en temps réel via un lien web, pas d\'application à installer.', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String(i + 1)}>
                <span className="num">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATALOGUE ── */}
      <section className="persona-section" id="catalogue">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">trouver un hébergeur</span>
            <h2 className="section-title">
              Parcourez notre catalogue<br />
              de <span className="accent">centres référencés</span>.
            </h2>
            <p className="section-lead">
              Centres labellisés Éducation Nationale et partenaires LIAVO.
            </p>
          </div>
          <div className="catalogue-video-wrap reveal">
            <a href="/catalogue" className="catalogue-video-link" aria-label="Parcourir le catalogue">
              <video
                src="https://liavo-uploads.s3.gra.io.cloud.ovh.net/Video%20catalogue%20liavo.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="catalogue-video"
              />
              <div className="catalogue-video-overlay">
                <span className="catalogue-video-cta">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Parcourir le catalogue complet
                  <span className="arrow">→</span>
                </span>
              </div>
            </a>
          </div>
          <div className="catalogue-cta reveal">
            <Link className="btn btn-navy btn-lg" href="/catalogue">
              Voir tous les centres <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── NETWORK ── */}
      <section className="network-section" id="reseau">
        <div className="wrap">
          <div className="net-card reveal">
            <div>
              <span className="tag-persona">Réseaux &amp; fédérations</span>
              <h3>Vous pilotez un réseau d&apos;hébergeurs ?</h3>
              <p>
                LIAVO offre un dashboard de pilotage à votre fédération ou association : suivi des adhérents,
                KPIs réseau, invitation en masse, intégration APIDAE automatique.{' '}
                <strong style={{ color: 'var(--navy)', fontWeight: 500 }}>
                  Votre rôle de mise en relation reste central
                </strong>{' '}
                — LIAVO gère l&apos;administratif après la mise en relation que vous orchestrez.
              </p>
              <ul className="net-list">
                <li>Dashboard temps réel avec KPIs (demandes, devis, taux de réponse, CA généré)</li>
                <li>Onboarding score par centre adhérent</li>
                <li>Invitation en masse + import APIDAE</li>
              </ul>
              <a className="btn btn-navy btn-lg" href="mailto:contact@liavo.fr?subject=Démo réseau LIAVO">
                Demander une démo réseau <span className="arrow">→</span>
              </a>
            </div>
            <div className="net-kpi">
              <div className="k"><div className="lbl">Adhérents actifs</div><div className="v">54 centres</div></div>
              <div className="k"><div className="lbl">Zones couvertes</div><div className="v">Haute-Savoie + Isère</div></div>
              <div className="k"><div className="lbl">Import APIDAE</div><div className="v sync">APIDAE synchronisé</div></div>
              <div className="k"><div className="lbl">Statut</div><div className="v sync">Synchronisé</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="pricing" id="pricing">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">tarification</span>
            <h2 className="section-title">Tarifs <span className="accent">hébergeurs</span></h2>
          </div>
          <div className="pricing-banner reveal">
            <strong>Enseignants, associations, CSE, mairies :</strong> LIAVO est gratuit, sans limite de durée.
          </div>
          <PricingTable />
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section className="compliance" id="conformite">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">conforme &amp; sécurisé</span>
            <h2 className="section-title">
              Une plateforme<br /><span className="accent">aux normes</span>, sans compromis.
            </h2>
          </div>
          <div className="comp-grid">
            <div className="comp reveal" data-delay="1">
              <div className="ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z" /><path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h4>Données des mineurs protégées</h4>
              <p>
                Conforme RGPD. Fiches sanitaires, allergies, traitements médicaux, autorisations parentales : toutes les données sensibles
                des élèves sont hébergées en France sur infrastructure certifiée ISO 27001, sans transfert hors Union Européenne.
              </p>
            </div>
            <div className="comp reveal" data-delay="2">
              <div className="ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h6M8 17h4" />
                </svg>
              </div>
              <h4>Facturation électronique</h4>
              <p>Chorus Pro intégré pour les marchés publics. Format XML UBL 2.1 généré automatiquement.</p>
            </div>
            <div className="comp reveal" data-delay="3">
              <div className="ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4>Signature électronique</h4>
              <p>Conforme eIDAS pour les autorisations parentales et conventions de séjour. Valeur juridique garantie.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="final" id="contact">
        <div className="wrap">
          <h2 className="reveal">
            Prêt à <span className="accent">digitaliser</span><br />vos séjours ?
          </h2>
          <p className="reveal" data-delay="1">
            Trente jours d&apos;essai pour les hébergeurs. Gratuit, toujours, pour les enseignants et organisateurs.
          </p>
          <div className="final-cta reveal" data-delay="2">
            <a className="btn btn-primary btn-lg" href="#hebergeurs">
              Je suis hébergeur <span className="arrow">→</span>
            </a>
            <a className="btn btn-outline-light btn-lg" href="#enseignants">
              Je suis enseignant ou organisateur
            </a>
          </div>
          <div className="final-pills reveal" data-delay="3">
            <span>Conforme RGPD</span>
            <span>Chorus Pro intégré</span>
            <span>Vos données restent en France</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="wrap foot">
          <div className="foot-left">
            <Link href="/">
              <Logo size="sm" showTagline={false} />
            </Link>
            <div className="copy">
              © 2026 LIAVO SASU · 102 994 910 RCS Annecy<br />
              Du projet pédagogique à la facturation finale.
            </div>
          </div>
          <div className="foot-links">
            <div className="foot-col">
              <span className="h">Produit</span>
              <a href="#hebergeurs">Hébergeurs</a>
              <a href="#enseignants">Enseignants</a>
              <a href="#colonies">Colonies</a>
              <a href="#collaboratif">Espace collaboratif</a>
              <a href="#reseau">Réseaux</a>
              <Link href="/catalogue">Catalogue</Link>
              <a href="#pricing">Tarifs</a>
            </div>
            <div className="foot-col">
              <span className="h">Légal</span>
              <Link href="/legal/mentions-legales">Mentions légales</Link>
              <Link href="/legal/cgu">CGU</Link>
              <Link href="/legal/cgv-hebergeurs">CGV Hébergeurs</Link>
              <Link href="/legal/confidentialite">Confidentialité</Link>
              <Link href="/legal/mandat-facturation">Mandat de facturation</Link>
            </div>
            <div className="foot-col">
              <span className="h">Contact</span>
              <a href="mailto:contact@liavo.fr">contact@liavo.fr</a>
              <a href="#contact">Morillon, Haute-Savoie</a>
            </div>
          </div>
        </div>
      </footer>

      <a href="/catalogue" className="catalogue-fab" aria-label="Parcourir le catalogue">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="catalogue-fab-label">Catalogue</span>
      </a>

    </div>
  );
}
