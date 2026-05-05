'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/app/components/Logo';
import PricingTable from '@/app/components/PricingTable';
import './landing.css';

const CATALOGUE_CARDS = [
  { nom: 'Chalet Le Sauvageon', ville: 'Morillon', dept: '74', capacite: 30, tags: ['Agréé EN', 'Montagne', 'Ski'] },
  { nom: 'Domaine de la Clarée', ville: 'Val-des-Prés', dept: '05', capacite: 80, tags: ['Agréé EN', 'Randonnée', 'Haute montagne'] },
  { nom: 'Centre Les Pins', ville: 'Mimizan', dept: '40', capacite: 120, tags: ['Agréé EN', 'Mer', 'Surf'] },
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [catalogueQ, setCatalogueQ] = useState('');
  const router = useRouter();

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

  const handleCatalogueSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = catalogueQ.trim();
    router.push(q.length >= 2 ? `/catalogue?q=${encodeURIComponent(q)}` : '/catalogue');
  };

  return (
    <div className="liavo-landing">

      {/* ── NAV ── */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/">
            <Logo size="sm" showTagline={false} />
          </Link>
          <div className="nav-links">
            <a href="#hebergeurs">Hébergeurs</a>
            <a href="#collaboratif">Espace collaboratif</a>
            <a href="#enseignants">Enseignants</a>
            <a href="#colonies">Colonies</a>
            <Link href="/catalogue">Catalogue</Link>
            <a href="#pricing">Tarifs</a>
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
            <span className="hero-eyebrow">
              <span className="pulse" />
              Nouvelle plateforme · Disponible en France
            </span>
            <h1>
              Gérez tous vos séjours de groupe<br />
              depuis un <span className="accent">seul outil</span>.
            </h1>
            <p className="hero-sub">
              Développée par des hébergeurs, pour des hébergeurs. Gérez vos devis, planning,
              CRM, facturation Chorus Pro et coordonnez chaque séjour avec l&apos;organisateur en temps réel.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#hebergeurs">
                Je suis hébergeur <span className="arrow">→</span>
              </a>
              <a className="btn btn-outline btn-lg" href="#enseignants">
                J&apos;organise un séjour scolaire
              </a>
              <a className="btn btn-outline btn-lg" href="#colonies">
                J&apos;organise une colonie
              </a>
            </div>
            <div className="hero-note">
              30 jours d&apos;essai · sans CB ·{' '}
              <Link href="/catalogue" className="underline" style={{ color: 'var(--ocre)' }}>
                Parcourir le catalogue de centres →
              </Link>
            </div>
            <div className="hero-pills">
              <span className="pill"><span className="dot" />Conforme RGPD</span>
              <span className="pill"><span className="dot" />Chorus Pro intégré</span>
              <span className="pill"><span className="dot" />Vos données restent en France</span>
            </div>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="hero-mockup-wrap">
          <div className="dashboard reveal">
            <aside className="dash-side">
              <div className="ds-brand">
                <Logo size="sm" showTagline={false} />
              </div>
              <span className="ds-group">Séjour</span>
              <span role="button">Vue d&apos;ensemble</span>
              <span role="button" className="active">Participants</span>
              <span role="button">Planning</span>
              <span role="button">Devis</span>
              <span role="button">Messages</span>
              <span role="button">Journal</span>
              <span className="ds-group">Centre</span>
              <span role="button">Catalogue</span>
              <span role="button">Facturation</span>
              <span role="button">CRM clients</span>
            </aside>
            <main className="dash-main">
              <div className="dash-bar">
                <div className="crumb">
                  <strong>Centre du Lac</strong> · Classe de montagne · 4ème · Morillon
                </div>
                <div className="actions">
                  <span className="mini">Exporter</span>
                  <span className="mini solid">Inviter</span>
                </div>
              </div>
              <div className="dash-h">
                <h3>Participants &amp; autorisations</h3>
                <span className="sub">17–21 mars 2026 · 48 élèves</span>
              </div>
              <div className="dash-kpis">
                <div className="kpi">
                  <div className="lbl">Inscrits</div>
                  <div className="val">48</div>
                  <div className="delta">+3 cette semaine</div>
                </div>
                <div className="kpi accent">
                  <div className="lbl">Autorisations</div>
                  <div className="val">44/48</div>
                  <div className="delta">92 % signées</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Paiements</div>
                  <div className="val">35/48</div>
                  <div className="delta">8 320 € collectés</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Facture HT</div>
                  <div className="val">12 480 €</div>
                  <div className="delta">Émise le 12 mars</div>
                </div>
              </div>
              <div className="dash-table">
                <div className="row head">
                  <span>Élève</span>
                  <span>Autorisation</span>
                  <span className="h-pay">Paiement</span>
                  <span className="h-fic">Fiche sanitaire</span>
                  <span className="h-more" />
                </div>
                <div className="row">
                  <div className="who"><span className="av">AM</span>Amélie Maréchal</div>
                  <span><span className="tag ok"><span className="pin" />Signé</span></span>
                  <span className="c-pay"><span className="tag ok"><span className="pin" />Échelonné</span></span>
                  <span className="c-fic"><span className="tag ok"><span className="pin" />OK</span></span>
                  <span className="c-more more">→</span>
                </div>
                <div className="row">
                  <div className="who"><span className="av">BL</span>Bastien Loiseau</div>
                  <span><span className="tag ok"><span className="pin" />Signé</span></span>
                  <span className="c-pay"><span className="tag wait"><span className="pin" />En attente</span></span>
                  <span className="c-fic"><span className="tag ok"><span className="pin" />OK</span></span>
                  <span className="c-more more">→</span>
                </div>
                <div className="row">
                  <div className="who"><span className="av">CM</span>Camille Mercier</div>
                  <span><span className="tag wait"><span className="pin" />En attente</span></span>
                  <span className="c-pay"><span className="tag no"><span className="pin" />—</span></span>
                  <span className="c-fic"><span className="tag wait"><span className="pin" />Sans gluten</span></span>
                  <span className="c-more more">→</span>
                </div>
                <div className="row">
                  <div className="who"><span className="av">DR</span>Diego Rovira</div>
                  <span><span className="tag ok"><span className="pin" />Signé</span></span>
                  <span className="c-pay"><span className="tag ok"><span className="pin" />Soldé</span></span>
                  <span className="c-fic"><span className="tag ok"><span className="pin" />OK</span></span>
                  <span className="c-more more">→</span>
                </div>
              </div>
            </main>
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
              <span className="badge payant">Solution payante</span>
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
              <span className="badge gratuit">Gratuit</span>
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
              <span className="badge gratuit">Gratuit</span>
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
              { n: '01', t: 'Un compte, plusieurs centres', d: 'Que vous gériez un seul gîte ou une association avec dix hébergements, LIAVO regroupe tout sous une seule organisation. Chaque centre a son propre profil et ses propres séjours.' },
              { n: '02', t: 'Dashboard collaboratif par séjour', d: "Pour chaque séjour collectif réservé, un espace partagé avec l'enseignant ou l'organisateur : messagerie, planning, participants, documents. Visibilité temps réel sur chaque dossier." },
              { n: '03', t: 'Planning drag & drop', d: 'Organisez la semaine en glisser-déposer. Les groupes tournent automatiquement sur les activités. Export PDF A4 paysage pour l\'impression.' },
              { n: '04', t: 'CRM clients intégré', d: 'Gérez vos établissements scolaires et organisateurs récurrents, suivez l\'historique de chaque client, relancez en un clic.' },
              { n: '05', t: 'Documents administratifs du centre', d: 'Centralisez vos documents réglementaires (agrément Éducation Nationale, RC Pro, attestations) avec suivi de date d\'expiration. L\'organisateur y accède directement depuis l\'espace collaboratif sans avoir à les redemander à chaque séjour.' },
              { n: '06', t: 'Facturation Chorus Pro intégrée', d: 'Facturez les établissements publics au format XML UBL 2.1, sans démarche supplémentaire. Conforme aux exigences de la facturation électronique.' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String((i % 5) + 1)}>
                <span className="num">{f.n}</span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
          <div className="ps-cta reveal">
            <a className="btn btn-primary btn-lg" href="#pricing">Essayer gratuitement <span className="arrow">→</span></a>
            <a className="btn btn-outline btn-lg" href="#pricing">Voir le pricing</a>
          </div>
        </div>
      </section>

      {/* ── COLLABORATIF ── */}
      <section className="persona-section" id="collaboratif">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="tag-persona">Différenciation · Inexistant ailleurs</span>
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
          <div className="hero-pills reveal" style={{ justifyContent: 'flex-start', marginBottom: '40px' }}>
            {['Hébergeur', 'Enseignant / Organisateur', 'Directeur / Signataire', 'Autorité (rectorat / SDJES)', 'Familles'].map((p) => (
              <span key={p} className="pill"><span className="dot" />{p}</span>
            ))}
          </div>
          <div className="features cols-3">
            {[
              { n: '01', t: 'Messagerie et documents centralisés', d: 'Fini les chaînes d\'emails et les fichiers Word partagés en drive. Toutes les conversations et tous les documents du séjour au même endroit, accessibles à chaque partie prenante avec les bons droits.' },
              { n: '02', t: 'Planning temps réel', d: 'Drag & drop collaboratif, visible par toutes les parties prenantes. Modifications instantanées, export PDF A4 paysage prêt à imprimer pour les encadrants.' },
              { n: '03', t: 'Journal de séjour pour les familles', d: 'Photos, planning du jour, nouvelles depuis le terrain. Les familles suivent en temps réel via un lien web, pas d\'app à installer.' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String(i + 1)}>
                <span className="num">{f.n}</span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
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
              De l&apos;appel d&apos;offres à la signature de la convention, LIAVO automatise tout le workflow administratif.
              Gratuit, toujours.
            </p>
          </div>
          <div className="features">
            {[
              { n: '01', t: "Appel d'offres en quelques minutes", d: "Décrivez votre projet (destination, dates, nombre d'élèves), les centres répondent directement avec leurs devis. Comparez sans relancer par email." },
              { n: '02', t: 'Signature électronique de la convention', d: "Le directeur d'école ou chef d'établissement signe la convention en ligne. LIAVO génère le dossier de déclaration que l'enseignant transmet lui-même à l'autorité académique compétente (IEN de circonscription pour le 1er degré, rectorat pour le 2nd degré)." },
              { n: '03', t: 'Autorisations parentales numériques', d: 'Importez votre liste d\'élèves depuis Pronote ou ONDE en CSV. Les parents signent en ligne (fiche sanitaire, régime alimentaire, paiement échelonné).' },
              { n: '04', t: 'Espace collaboratif avec l\'hébergeur et les familles', d: 'Planning, messagerie, documents et journal de séjour. Les familles suivent le séjour en temps réel via un lien web, sans application.' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String(i + 1)}>
                <span className="num">{f.n}</span>
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
              { n: '01', t: 'Recherche d\'hébergeur géolocalisée', d: 'Lancez votre demande dans la zone qui vous intéresse, recevez des devis qualifiés des centres disponibles à vos dates.' },
              { n: '02', t: 'Planning d\'activités drag & drop', d: 'Construisez le programme de la colo semaine par semaine. Glissez-déposez les activités, gérez les groupes et les rotations, exportez le planning en PDF pour les animateurs.' },
              { n: '03', t: 'Espace collaboratif avec l\'hébergeur', d: 'Messagerie, documents, participants et autorisations parentales. Tout partagé avec le centre d\'hébergement depuis un espace commun.' },
              { n: '04', t: 'Journal de séjour pour les familles', d: 'Les parents reçoivent un journal de séjour pendant les vacances : photos, planning du jour, nouvelles. Pas d\'app à installer.' },
              { n: '05', t: 'Déclaration TAM simplifiée', d: 'Préparez le dossier de déclaration auprès du SDJES depuis les données du séjour. Téléchargez le dossier complet, prêt à transmettre.' },
            ].map((f, i) => (
              <div key={f.n} className="feature reveal" data-delay={String((i % 5) + 1)}>
                <span className="num">{f.n}</span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
          <div className="ps-cta reveal">
            <Link className="btn btn-primary btn-lg" href="/appel-offres">
              Tester gratuitement <span className="arrow">→</span>
            </Link>
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
              Centres labellisés Éducation Nationale, agréés TAM et partenaires LIAVO.
            </p>
          </div>
          <form className="catalogue-search-wrap reveal" onSubmit={handleCatalogueSearch}>
            <svg className="catalogue-search-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="catalogue-search"
              placeholder="Rechercher par nom, ville, département…"
              value={catalogueQ}
              onChange={(e) => setCatalogueQ(e.target.value)}
            />
          </form>
          <div className="catalogue-grid">
            {CATALOGUE_CARDS.map((c) => (
              <Link key={c.nom} href="/catalogue" className="cat-card reveal">
                <h4>{c.nom}</h4>
                <p className="loc">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {c.ville} ({c.dept})
                </p>
                <p className="cap">{c.capacite} lits</p>
                <div className="tags">
                  {c.tags.map((t) => (
                    <span key={t} className={`ctag${t === 'Agréé EN' ? ' en' : ''}`}>{t}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
          <div className="catalogue-cta reveal">
            <Link className="btn btn-navy btn-lg" href="/catalogue">
              Voir tous les centres <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── NETWORK ── */}
      <section className="network-section">
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
            <span className="eyebrow">tarifs hébergeurs</span>
            <h2 className="section-title">
              Un prix lisible,<br /><span className="accent">pas de palier surprise</span>.
            </h2>
            <p className="section-lead">
              Trois formules pour les hébergeurs. Les enseignants et organisateurs de colonies utilisent LIAVO gratuitement.
            </p>
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
                Fiches sanitaires, allergies, traitements médicaux, autorisations parentales : toutes les données sensibles
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
              <Logo size="sm" showTagline={true} />
            </Link>
            <div className="copy">
              © 2026 LIAVO SASU · 102 994 910 RCS Annecy<br />
              Le standard des séjours collectifs en France.
            </div>
          </div>
          <div className="foot-links">
            <div className="foot-col">
              <span className="h">Produit</span>
              <a href="#hebergeurs">Hébergeurs</a>
              <a href="#collaboratif">Espace collaboratif</a>
              <a href="#enseignants">Enseignants</a>
              <a href="#colonies">Colonies</a>
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
              <a href="#contact">Annecy, France</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
