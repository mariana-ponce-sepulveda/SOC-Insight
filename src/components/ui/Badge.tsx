import React from 'react';
import { RISK_COLORS, THEME } from '../../constants/rules';
import type { RiskLevel } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant = 'default' | 'outline';

export interface BadgeProps {
  /** Si se proporciona, aplica los colores correspondientes al nivel de riesgo */
  riskLevel?: RiskLevel;
  /** Variante visual: 'default' (fondo sólido) o 'outline' (borde, fondo semitransparente) */
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Badge de nivel de riesgo o etiqueta genérica.
 * - Cuando riskLevel está definido usa RISK_COLORS del diseño.
 * - Cumple WCAG 2.1 AA (contraste ≥ 4.5:1 en todos los pares definidos).
 */
const Badge: React.FC<BadgeProps> = ({
  riskLevel,
  variant = 'default',
  children,
  className,
  style,
}) => {
  // Resolve colors based on riskLevel or fallback to theme muted
  const resolvedBg   = riskLevel ? RISK_COLORS[riskLevel].bg   : THEME.surface;
  const resolvedText = riskLevel ? RISK_COLORS[riskLevel].text : THEME.textPrimary;

  const baseStyle: React.CSSProperties = {
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '0.1875rem 0.5rem',
    borderRadius:  '9999px',     // pill shape
    fontSize:      '0.75rem',
    fontWeight:    700,
    letterSpacing: '0.025em',
    lineHeight:    1.4,
    whiteSpace:    'nowrap',
    userSelect:    'none',
    fontFamily:    'inherit',
  };

  let variantStyle: React.CSSProperties;
  if (variant === 'outline') {
    variantStyle = {
      backgroundColor: `${resolvedBg}22`,  // ~13 % opacidad
      color:           riskLevel ? resolvedBg : THEME.textMuted,
      border:          `1px solid ${riskLevel ? resolvedBg : THEME.border}`,
    };
  } else {
    variantStyle = {
      backgroundColor: resolvedBg,
      color:           resolvedText,
      border:          '1px solid transparent',
    };
  }

  return (
    <span
      className={className}
      style={{ ...baseStyle, ...variantStyle, ...style }}
      // Semántica: si se usa como estado/etiqueta es decorativo, si conveys meaning → consumer añade aria-label
    >
      {children ?? riskLevel}
    </span>
  );
};

export default Badge;
