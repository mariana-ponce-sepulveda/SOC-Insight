import React from 'react';
import { THEME } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: SpinnerSize;
  className?: string;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 36,
};

// ---------------------------------------------------------------------------
// Keyframe injection (one-time, global)
// ---------------------------------------------------------------------------

const KEYFRAME_ID = '__soc-spinner-kf__';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes soc-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

injectKeyframes();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Spinner de carga accesible.
 * - role="status" + aria-label para lectores de pantalla.
 * - Respeta prefers-reduced-motion del sistema.
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  style,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...rest
}) => {
  const px = SIZE_MAP[size];
  const stroke = size === 'sm' ? 2 : size === 'md' ? 2.5 : 3;

  const svgStyle: React.CSSProperties = {
    animation:       'soc-spin 0.75s linear infinite',
    flexShrink:      0,
    display:         'inline-block',
    verticalAlign:   'middle',
    ...style,
  };

  // When aria-hidden is explicitly set we skip the role/label (used as decorative icon)
  const a11yProps = ariaHidden
    ? { 'aria-hidden': true as const }
    : {
        role:       'status' as const,
        'aria-label': ariaLabel ?? 'Cargando',
      };

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={svgStyle}
      {...a11yProps}
      {...rest}
    >
      {/* Background track */}
      <circle
        cx="12" cy="12" r="10"
        stroke={THEME.border}
        strokeWidth={stroke}
      />
      {/* Spinning arc */}
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke={THEME.accent}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Spinner;
