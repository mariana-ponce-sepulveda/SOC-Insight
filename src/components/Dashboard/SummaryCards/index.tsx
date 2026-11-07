import React from 'react';
import { Card } from '../../ui';
import { RISK_COLORS, THEME } from '../../../constants/rules';
import type { RiskLevel } from '../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SummaryCardsProps {
  totalRecords: number;
  totalIncidents: number;
  incidentsByLevel: Record<RiskLevel, number>;
}

// ---------------------------------------------------------------------------
// SVG Icons (inline, no external dependencies)
// ---------------------------------------------------------------------------

const IconDatabase: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const IconAlertTriangle: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconFlame: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const IconExclamationCircle: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconShieldAlert: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheckCircle: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconInfo: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ---------------------------------------------------------------------------
// StatCard — individual summary card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  /** Color del acento (icono + borde izquierdo) */
  accentColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, accentColor }) => {
  const cardStyle: React.CSSProperties = {
    borderLeft: `4px solid ${accentColor}`,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minWidth: 0, // permite que el grid lo comprima si hace falta
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: THEME.textPrimary,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <Card style={cardStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={{ color: accentColor, flexShrink: 0 }} aria-hidden="true">
          {icon}
        </span>
      </div>
      <span style={valueStyle}>{value.toLocaleString('es-ES')}</span>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// SummaryCards
// ---------------------------------------------------------------------------

/**
 * Rejilla de 7 tarjetas de resumen estadístico para el dashboard.
 *
 * Columnas auto-fill con tamaño mínimo de 140 px, responsivo.
 */
const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalRecords,
  totalIncidents,
  incidentsByLevel,
}) => {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1rem',
  };

  const ICON_SIZE = 20;

  const cards: StatCardProps[] = [
    {
      label: 'Registros analizados',
      value: totalRecords,
      accentColor: THEME.accent,
      icon: <IconDatabase size={ICON_SIZE} color={THEME.accent} />,
    },
    {
      label: 'Incidentes detectados',
      value: totalIncidents,
      accentColor: THEME.textMuted,
      icon: <IconAlertTriangle size={ICON_SIZE} color={THEME.textMuted} />,
    },
    {
      label: 'Crítico',
      value: incidentsByLevel['CRÍTICO'],
      accentColor: RISK_COLORS['CRÍTICO'].bg,
      icon: <IconFlame size={ICON_SIZE} color={RISK_COLORS['CRÍTICO'].bg} />,
    },
    {
      label: 'Alto',
      value: incidentsByLevel['ALTO'],
      accentColor: RISK_COLORS['ALTO'].bg,
      icon: <IconExclamationCircle size={ICON_SIZE} color={RISK_COLORS['ALTO'].bg} />,
    },
    {
      label: 'Medio',
      value: incidentsByLevel['MEDIO'],
      accentColor: RISK_COLORS['MEDIO'].bg,
      icon: <IconShieldAlert size={ICON_SIZE} color={RISK_COLORS['MEDIO'].bg} />,
    },
    {
      label: 'Bajo',
      value: incidentsByLevel['BAJO'],
      accentColor: RISK_COLORS['BAJO'].bg,
      icon: <IconCheckCircle size={ICON_SIZE} color={RISK_COLORS['BAJO'].bg} />,
    },
    {
      label: 'Informativo',
      value: incidentsByLevel['INFORMATIVO'],
      accentColor: RISK_COLORS['INFORMATIVO'].bg,
      icon: <IconInfo size={ICON_SIZE} color={RISK_COLORS['INFORMATIVO'].bg} />,
    },
  ];

  return (
    <section aria-label="Resumen estadístico del análisis" style={gridStyle}>
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </section>
  );
};

export default SummaryCards;
