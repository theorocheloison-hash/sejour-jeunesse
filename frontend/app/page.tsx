'use client';

import Link from 'next/link';
import { Logo } from '@/app/components/Logo';
import { ActeursSchema } from '@/app/components/ActeursSchema';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {/* ── NAV FIXE ────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', inset: '0 0 auto 0', zIndex: 50,
        backgroundColor: 'var(--color-surface)',
        borderBottom: '0.5px solid var(--color-border)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 24px', display: 'flex',
          height: 56, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Logo size="sm" variant="light" showTagline={false} />
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden md:flex">
            <a href="#acteurs" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Pour les établissements
            </a>
            <a href="#acteurs" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Pour les hébergeurs
            </a>
            <a href="#workflow" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Comment ça marche
            </a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" className="hidden sm:inline-flex" style={{
              fontSize: 13, fontWeight: 500, padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border)',
              color: 'var(--color-primary)', textDecoration: 'none',
              backgroundColor: 'transparent',
            }}>
              Se connecter
            </Link>
            <Link href="/register" style={{
              fontSize: 13, fontWeight: 500, padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF', textDecoration: 'none',
            }}>
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      {/* ── SECTION 1 — HERO ────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500,
            lineHeight: 1.15, letterSpacing: '-0.01em',
            color: 'var(--color-primary)',
          }}>
            Du projet pédagogique à la facturation finale.
            <br />
            <span style={{ color: 'var(--color-text-muted)' }}>
              Chaque étape coordonnée. Chaque validation tracée.
            </span>
          </h1>

          <p style={{
            marginTop: 24, fontSize: 15, lineHeight: 1.7,
            color: 'var(--color-text-muted)', maxWidth: 600,
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            LIAVO digitalise l&apos;intégralité de la démarche administrative d&apos;un séjour scolaire — appel d&apos;offres hébergeurs, validations directeur et rectorat, autorisations parentales, paiements échelonnés, Chorus Pro. Cinq acteurs. Un seul workflow.
          </p>

          <div style={{
            marginTop: 32, display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', gap: 12,
          }}>
            <Link href="/register?type=teacher" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF', textDecoration: 'none',
            }}>
              Je suis un établissement scolaire
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
            <Link href="/register?type=venue" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border-strong)',
              color: 'var(--color-primary)', textDecoration: 'none',
              backgroundColor: 'transparent',
            }}>
              Je suis un hébergeur
            </Link>
          </div>
        </div>

        {/* Bandeau preuves */}
        <div style={{
          marginTop: 64,
          backgroundColor: 'var(--color-surface)',
          borderTop: '0.5px solid var(--color-border)',
          borderBottom: '0.5px solid var(--color-border)',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: 13, color: 'var(--color-text-muted)',
        }}>
          649 centres référencés depuis la base officielle de l&apos;Éducation Nationale · Conforme RGPD, hébergé en France · Chorus Pro intégré
        </div>
      </section>

      {/* ── SECTION 2 — LA DOULEUR ──────────────────────────────────────────── */}
      <section id="probleme" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 500,
            color: 'var(--color-primary)', textAlign: 'center',
            marginBottom: 48,
          }}>
            Organiser un séjour scolaire aujourd&apos;hui, c&apos;est ça.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center' }} className="max-md:!grid-cols-1">
            {/* Colonne Aujourd'hui */}
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                backgroundColor: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                fontSize: 12, fontWeight: 500,
                padding: '4px 12px', borderRadius: 'var(--radius-pill)',
                marginBottom: 16,
              }}>
                Sans LIAVO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Des semaines d\'emails pour obtenir des devis comparables',
                  'Des autorisations parentales perdues, relancées manuellement',
                  'Des dossiers rectorat en PDF remplis à la main',
                  'Une responsabilité administrative portée seul',
                ].map((t, i) => (
                  <div key={i} style={{
                    backgroundColor: 'var(--color-surface)',
                    borderLeft: '3px solid var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    fontSize: 14, lineHeight: 1.6,
                    color: 'var(--color-text-muted)',
                  }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Flèche centrale — desktop uniquement */}
            <div className="hidden md:flex" style={{
              fontSize: 32, color: 'var(--color-accent)',
              alignSelf: 'center', padding: '0 8px',
            }}>
              →
            </div>

            {/* Colonne Avec LIAVO */}
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                backgroundColor: 'var(--color-success-light)',
                color: 'var(--color-success)',
                fontSize: 12, fontWeight: 500,
                padding: '4px 12px', borderRadius: 'var(--radius-pill)',
                marginBottom: 16,
              }}>
                Avec LIAVO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Devis reçus en 48h de tous les centres de votre région',
                  'Signatures électroniques avec relances automatiques',
                  'Dossier généré automatiquement, envoyé directement',
                  'Chaque validation horodatée, archivée, traçable',
                ].map((t, i) => (
                  <div key={i} style={{
                    backgroundColor: 'var(--color-surface)',
                    borderLeft: '3px solid var(--color-accent)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    fontSize: 14, lineHeight: 1.6,
                    color: 'var(--color-text)',
                  }}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — 5 ACTEURS ───────────────────────────────────────────── */}
      <section id="acteurs" style={{
        padding: '80px 24px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '0.5px solid var(--color-border)',
        borderBottom: '0.5px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 500,
            color: 'var(--color-primary)', textAlign: 'center',
            marginBottom: 16,
          }}>
            La première plateforme qui connecte tous les acteurs d&apos;un séjour scolaire.
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.7,
            color: 'var(--color-text-muted)', textAlign: 'center',
            maxWidth: 560, margin: '0 auto 48px',
          }}>
            Pas un outil de plus dans votre boîte mail. Une infrastructure partagée où chaque acteur intervient au bon moment, dans le bon ordre.
          </p>
          <ActeursSchema />
        </div>
      </section>

      {/* ── SECTION 4 — DEUX UNIVERS ────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}>
          {/* Bloc établissements */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: 32,
            display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 20 }}>
              Pour les enseignants et les directeurs
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {[
                'Lancez un appel d\'offres en 10 minutes auprès de 649 centres référencés',
                'Recevez et comparez les devis directement dans la plateforme',
                'Workflow de validation directeur et rectorat intégré',
                'Autorisations parentales numériques avec relances automatiques',
                'Paiement échelonné jusqu\'à 10 fois sans frais pour les familles',
                'Ordres de mission accompagnateurs générés automatiquement',
              ].map((t, i) => (
                <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                  — {t}
                </li>
              ))}
            </ul>
            <Link href="/register?type=teacher" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 24, fontSize: 14, fontWeight: 500,
              padding: '10px 20px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF', textDecoration: 'none',
              alignSelf: 'flex-start',
            }}>
              Créer un compte établissement
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>

          {/* Bloc hébergeurs */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: 32,
            display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 20 }}>
              Pour les centres d&apos;hébergement
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {[
                'Recevez des demandes qualifiées directement depuis les établissements',
                'Créez vos devis HT/TTC en quelques minutes',
                'Gérez votre calendrier et vos disponibilités',
                'Facturation Chorus Pro intégrée pour les établissements publics',
                'Espace collaboratif avec l\'enseignant organisateur',
              ].map((t, i) => (
                <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                  — {t}
                </li>
              ))}
            </ul>
            <Link href="/register?type=venue" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 24, fontSize: 14, fontWeight: 500,
              padding: '10px 20px', borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border-strong)',
              color: 'var(--color-primary)', textDecoration: 'none',
              backgroundColor: 'transparent', alignSelf: 'flex-start',
            }}>
              Référencer mon centre
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — WORKFLOW ─────────────────────────────────────────────── */}
      <section id="workflow" style={{
        padding: '80px 24px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '0.5px solid var(--color-border)',
        borderBottom: '0.5px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 500,
            color: 'var(--color-primary)', textAlign: 'center',
            marginBottom: 12,
          }}>
            De l&apos;idée au séjour en 6 étapes.
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.7,
            color: 'var(--color-text-muted)', textAlign: 'center',
            maxWidth: 480, margin: '0 auto 48px',
          }}>
            Chaque étape débloque la suivante. Aucune validation ne peut être sautée.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {[
              { num: '1', title: 'Création du projet', desc: 'L\'enseignant définit la destination, les dates et les objectifs pédagogiques. Le dossier s\'ouvre automatiquement.' },
              { num: '2', title: 'Appel d\'offres hébergeurs', desc: 'Les 649 centres référencés de la région reçoivent la demande. Les devis arrivent directement dans la plateforme sous 48h.' },
              { num: '3', title: 'Validation directeur', desc: 'Le directeur compare les offres, sélectionne le centre et approuve le séjour. Tout est horodaté.' },
              { num: '4', title: 'Dossier rectorat', desc: 'Le dossier réglementaire complet est généré automatiquement et transmis au rectorat pour validation.' },
              { num: '5', title: 'Autorisations et paiements', desc: 'Les parents reçoivent l\'autorisation à signer en ligne. Le paiement s\'échelonne jusqu\'à 10 fois sans frais.' },
              { num: '6', title: 'Le séjour a lieu', desc: 'L\'espace collaboratif relie enseignant, hébergeur et accompagnateurs jusqu\'au retour.' },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 48, height: 48, minWidth: 48,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent-light)',
                  color: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 500,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', marginBottom: 4 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — ARGUMENTS INSTITUTIONNELS ────────────────────────────── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 500,
            color: 'var(--color-primary)', textAlign: 'center',
            marginBottom: 48,
          }}>
            Conçu pour les exigences de l&apos;Éducation Nationale.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 24,
          }}>
            {[
              { title: 'Données sécurisées', desc: 'Hébergement sur sol français. Conformité RGPD complète. Chaque donnée d\'élève est protégée selon les exigences de l\'Éducation Nationale.' },
              { title: 'Chorus Pro intégré', desc: 'Facturation électronique vers les établissements publics, sans démarche supplémentaire pour l\'hébergeur.' },
              { title: 'Traçabilité complète', desc: 'Chaque validation, chaque document, chaque autorisation est horodaté et archivé. En cas de contrôle, l\'historique complet est disponible en un clic.' },
            ].map((card, i) => (
              <div key={i} style={{
                backgroundColor: 'var(--color-surface)',
                border: '0.5px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 28,
              }}>
                <div style={{
                  width: 32, height: 2,
                  backgroundColor: 'var(--color-accent)',
                  marginBottom: 16, borderRadius: 1,
                }} />
                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 8 }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', margin: 0 }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 — CTA FINAL ───────────────────────────────────────────── */}
      <section style={{
        padding: '80px 24px',
        backgroundColor: 'var(--color-primary-light)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 500,
            color: 'var(--color-primary)', marginBottom: 16,
          }}>
            Prêt à coordonner votre prochain séjour ?
          </h2>
          <p style={{
            fontSize: 15, lineHeight: 1.7,
            color: 'var(--color-text-muted)',
            maxWidth: 520, margin: '0 auto 32px',
          }}>
            649 centres référencés depuis la base officielle de l&apos;Éducation Nationale. Rejoignez les établissements qui ont déjà rejoint LIAVO.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <Link href="/register?type=teacher" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF', textDecoration: 'none',
            }}>
              Créer un compte établissement
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
            <Link href="/register?type=venue" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 500, padding: '12px 24px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--color-border-strong)',
              color: 'var(--color-primary)', textDecoration: 'none',
              backgroundColor: 'transparent',
            }}>
              Référencer mon centre
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{
        backgroundColor: 'var(--color-bg)',
        borderTop: '0.5px solid var(--color-border)',
        padding: '40px 24px',
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between',
          gap: 24,
        }}>
          <Logo size="sm" variant="light" showTagline={true} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>CGU</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Politique de confidentialité</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
          </div>
        </div>
        <div style={{
          maxWidth: 960, margin: '16px auto 0',
          borderTop: '0.5px solid var(--color-border)',
          paddingTop: 16, textAlign: 'center',
          fontSize: 13, color: 'var(--color-text-muted)',
        }}>
          © 2026 LIAVO · liavo.fr
        </div>
      </footer>
    </div>
  );
}
