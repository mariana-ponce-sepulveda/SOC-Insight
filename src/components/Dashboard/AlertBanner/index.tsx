import React from 'react';
import { THEME } from '../../../constants/rules';
import type { RiskLevel } from '../../../types';

export interface AlertBannerProps {
  incidentsByLevel: Record<RiskLevel, number>;
  totalIncidents: number;
  totalRecords: number;
}

const AlertBanner: React.FC<AlertBannerProps> = ({
  incidentsByLevel,
  totalIncidents,
  totalRecords,
}) => {
  const criticoVal = incidentsByLevel['CRÍTICO'] ?? 0;
  const altoVal    = incidentsByLevel['ALTO']    ?? 0;
  const medioVal   = incidentsByLevel['MEDIO']   ?? 0;
  const bajoVal    = incidentsByLevel['BAJO']    ?? 0;

  const rate =
    totalRecords > 0
      ? ((totalIncidents / totalRecords) * 100).toFixed(1)
      : '0.0';

  // Chips: only levels with count > 0
  const chips: Array<{ level: string; count: number; borderColor: string; desc: string }> = [];
  if (criticoVal > 0)
    chips.push({ level: 'CRÍTICO', count: criticoVal, borderColor: '#B91C1C', desc: 'Acción inmediata (< 1 hora)' });
  if (altoVal > 0)
    chips.push({ level: 'ALTO', count: altoVal, borderColor: '#C2410C', desc: 'Revisión prioritaria (< 4 h)' });
  if (medioVal > 0)
    chips.push({ level: 'MEDIO', count: medioVal, borderColor: '#B45309', desc: 'Programar revisión en 24 h' });
  if (bajoVal > 0)
    chips.push({ level: 'BAJO', count: bajoVal, borderColor: '#15803D', desc: 'Monitorear y documentar' });

  return (
    <div>
      {/* ── Alert banner: CRÍTICO ── */}
      {criticoVal > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.875rem 1.25rem',
            marginBottom: '0.75rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }} aria-hidden="true">🚨</span>
          <span style={{ fontWeight: 700, color: '#B91C1C', fontSize: '0.9375rem' }}>
            ALTA AMENAZA DETECTADA: Se han identificado {criticoVal} incidente(s) críticos.
            Se requiere contención inmediata.
          </span>
        </div>
      )}

      {/* ── Alert banner: ALTO (only when no CRÍTICO) ── */}
      {criticoVal === 0 && altoVal > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.875rem 1.25rem',
            marginBottom: '0.75rem',
            backgroundColor: '#FFF7ED',
            border: '1px solid #FED7AA',
            borderRadius: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }} aria-hidden="true">⚠️</span>
          <span style={{ fontWeight: 700, color: '#C2410C', fontSize: '0.9375rem' }}>
            ATENCIÓN: Se detectaron {altoVal} incidente(s) de nivel ALTO.
            Revisión prioritaria recomendada.
          </span>
        </div>
      )}

      {/* ── Executive summary block ── */}
      {totalIncidents > 0 && (
        <div
          style={{
            backgroundColor: THEME.surface,
            border: `1px solid ${THEME.border}`,
            borderLeft: `4px solid ${THEME.accent}`,
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            marginBottom: '0.75rem',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: THEME.textPrimary,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Resumen ejecutivo del análisis
          </p>

          <p
            style={{
              margin: '0 0 0.875rem 0',
              fontSize: '0.875rem',
              color: THEME.textMuted,
              lineHeight: 1.6,
            }}
          >
            Se analizaron{' '}
            <strong style={{ color: THEME.textPrimary }}>
              {totalRecords.toLocaleString('es-ES')} registros
            </strong>{' '}
            y se identificaron{' '}
            <strong style={{ color: THEME.textPrimary }}>
              {totalIncidents} situaciones
            </strong>{' '}
            que requieren atención (tasa de detección: {rate}%).
          </p>

          {/* Level chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {chips.map((chip) => (
              <div
                key={chip.level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  backgroundColor: THEME.background,
                  border: `1px solid ${THEME.border}`,
                  borderLeft: `3px solid ${chip.borderColor}`,
                  borderRadius: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ fontWeight: 700, color: chip.borderColor }}>
                  {chip.level}: {chip.count}
                </span>
                <span style={{ color: THEME.textMuted }}>— {chip.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertBanner;
