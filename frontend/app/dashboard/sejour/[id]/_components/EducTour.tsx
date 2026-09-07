'use client';

import { useEffect, useRef } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

// Tour de première connexion de l'espace organisateur (Lot 2 onboarding).
// La progression remonte au parent via onEtape (persistée par AuthContext) ;
// le tour ne bloque jamais l'usage : fermeture toujours possible, et toute
// fin (Terminer comme croix) marque le tour terminé.

export const NB_ETAPES = 7;

const STEPS: DriveStep[] = [
  {
    // step 0 — accueil, popover centré (pas d'élément)
    popover: {
      title: 'Bienvenue dans votre espace séjour',
      description: "Cet espace vous sert à organiser votre séjour, main dans la main avec l'hébergeur qui vous accueille. Voici un tour rapide, en 30 secondes.",
    },
  },
  {
    element: '[data-tour="reservation"]',
    popover: {
      title: 'Réservation',
      description: 'Ici vous signez votre devis pour confirmer le séjour, puis vous y retrouvez vos documents officiels.',
    },
  },
  {
    element: '[data-tour="pedagogie"]',
    popover: {
      title: 'Pédagogie',
      description: "Décrivez votre projet pédagogique, si votre établissement le demande. C'est optionnel.",
    },
  },
  {
    element: '[data-tour="budget"]',
    popover: {
      title: 'Budget',
      description: 'Suivez vos dépenses et vos recettes, et fixez le prix par élève. Optionnel, mais bien pratique.',
    },
  },
  {
    element: '[data-tour="inscriptions"]',
    popover: {
      title: 'Inscriptions',
      description: 'Votre responsabilité principale : la liste de vos élèves et de vos accompagnateurs.',
    },
  },
  {
    element: '[data-tour="surplace"]',
    popover: {
      title: 'Sur place',
      description: 'Répartissez vos élèves en groupes et dans les chambres, et consultez le planning du séjour.',
    },
  },
  {
    element: '[data-tour="echanges"]',
    popover: {
      title: 'Échanges',
      description: "Votre ligne directe avec l'hébergeur : messages, journal du séjour et documents partagés. Un tutoriel détaillé vous attend en haut de chaque onglet.",
    },
  },
];

interface EducTourProps {
  etapeInitiale: number;
  onEtape: (n: number) => void;
}

export default function EducTour({ etapeInitiale, onEtape }: EducTourProps) {
  // Ref pour que le driver (créé une seule fois) voie toujours le dernier callback.
  const onEtapeRef = useRef(onEtape);
  onEtapeRef.current = onEtape;
  // Distinguer la fermeture par l'utilisateur (→ terminé) du démontage React
  // (navigation) : le cleanup ne doit PAS marquer le tour comme terminé.
  const demontageRef = useRef(false);

  useEffect(() => {
    const driverObj = driver({
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      popoverClass: 'liavo-tour',
      onHighlightStarted: (_el, _step, opts) => {
        onEtapeRef.current(opts.state.activeIndex ?? 0);
      },
      onDestroyed: () => {
        if (!demontageRef.current) onEtapeRef.current(NB_ETAPES);
      },
      steps: STEPS,
    });
    driverObj.drive(Math.min(Math.max(etapeInitiale, 0), NB_ETAPES - 1));
    return () => {
      demontageRef.current = true;
      driverObj.destroy();
    };
    // Le driver est créé une seule fois au montage ; etapeInitiale ne sert qu'au départ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Habillage tokens LIAVO du popover driver.js (appendé au body, hors arbre React).
  return (
    <style>{`
      .driver-popover.liavo-tour {
        border-radius: 12px;
        font-family: Inter, system-ui, sans-serif;
        color: #374151;
      }
      .driver-popover.liavo-tour .driver-popover-title {
        color: var(--color-primary, #1B4060);
        font-size: 15px;
        font-weight: 600;
      }
      .driver-popover.liavo-tour .driver-popover-description {
        font-size: 13px;
        line-height: 1.5;
      }
      .driver-popover.liavo-tour .driver-popover-progress-text {
        color: var(--color-accent, #C77B3F);
        font-size: 11px;
        font-weight: 600;
      }
      .driver-popover.liavo-tour button.driver-popover-next-btn,
      .driver-popover.liavo-tour button.driver-popover-prev-btn {
        border-radius: 8px;
        text-shadow: none;
        font-weight: 600;
      }
      .driver-popover.liavo-tour button.driver-popover-next-btn {
        background-color: var(--color-primary, #1B4060);
        border: none;
        color: #fff;
      }
      .driver-popover.liavo-tour button.driver-popover-prev-btn {
        background-color: #fff;
        border: 1px solid #d1d5db;
        color: #374151;
      }
    `}</style>
  );
}
