/**
 * Smoke test — verifica que el entorno de testing está correctamente configurado.
 */
import { describe, it, expect } from 'vitest';

describe('Entorno de testing', () => {
  it('vitest y jsdom funcionan correctamente', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).toBeTruthy();
  });

  it('@testing-library/jest-dom está disponible', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    document.body.removeChild(el);
  });
});
