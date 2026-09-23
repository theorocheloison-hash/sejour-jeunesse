// Tests du diagnostic email académique (F2 — avertissement délivrabilité @ac-*.fr).
import { describe, it, expect } from 'vitest';
import { diagnostiquerEmail } from './email';

describe('diagnostiquerEmail', () => {
  it.each([
    'x@ac-grenoble.fr',
    'x@ac-aix-marseille.fr',
    'x@AC-Lille.FR',
    '  x@ac-nantes.fr ',
    'x@edu.ac-lyon.fr',
    'x@ac-noumea.nc',
  ])('« %s » → ACADEMIQUE', (email) => {
    expect(diagnostiquerEmail(email)).toBe('ACADEMIQUE');
  });

  it.each([
    'x@ac-grenoble.frle.fr',
    'x@ac-grenoble.com',
    'x@ac-.fr',
  ])('« %s » → ACADEMIQUE_MALFORME', (email) => {
    expect(diagnostiquerEmail(email)).toBe('ACADEMIQUE_MALFORME');
  });

  it.each([
    'x@gmail.com',
    'x@education.gouv.fr',
    '',
    'abc',
    'x@tac-truc.fr',
  ])('« %s » → null', (email) => {
    expect(diagnostiquerEmail(email)).toBeNull();
  });
});
