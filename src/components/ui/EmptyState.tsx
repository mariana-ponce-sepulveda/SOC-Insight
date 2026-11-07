import React from 'react';
import { THEME } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Icono React (SVG o componente). Si es string, se renderiza como texto grande */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Acción opcional: muestra un botón debajo de la descripción */
  action?: EmptyStateAction;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  textAlign:      'center',
  padding:        '3rem 1.5rem',
  gap:            '0.75rem',
};

const ICON_WRAPPER_STYLE: React.CSSProperties = {
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  width:           '4rem',
  height:          '4rem',
  borderRadius:    '50%',
  backgroundColor: `${THEME.border}55`,  // ~33 % opacidad
  marginBottom:    '0.25rem',
  fontSize:        '1.75rem',
  color:           THEME.textMuted,
};

const TITLE_STYLE: React.CSSProperties = {
  margin:     0,
  fontSize:   '1.0625rem',
  fontWeight: 600,
  color:      THEME.textPrimary,
  lineHeight: 1.4,
};

const DESC_STYLE: React.CSSProperties = {
  margin:     0,
  fontSize:   '0.9375rem',
  color:      THEME.textMuted,
  lineHeight: 1.6,
  maxWidth:   '36ch',
};

const ACTION_BTN_STYLE: React.CSSProperties = {
  marginTop:       '0.5rem',
  padding:         '0.5rem 1.25rem',
  backgroundColor: THEME.accent,
  color:           '#FFFFFF',
  border:          'none',
  borderRadius:    '0.375rem',
  fontSize:        '0.9375rem',
  fontWeight:      600,
  cursor:          'pointer',
  fontFamily:      'inherit',
  transition:      'opacity 150ms ease',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Estado vacío con icono, título, descripción y acción opcional.
 * Usado cuando no hay datos que mostrar (ej. dashboard sin sesión,
 * lista de incidentes vacía, resultados de filtro vacíos).
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{ ...CONTAINER_STYLE, ...style }}
      role="status"
      aria-label={title}
    >
      {icon !== undefined && (
        <div style={ICON_WRAPPER_STYLE} aria-hidden="true">
          {icon}
        </div>
      )}

      <h3 style={TITLE_STYLE}>{title}</h3>

      {description && (
        <p style={DESC_STYLE}>{description}</p>
      )}

      {action && (
        <button
          type="button"
          style={ACTION_BTN_STYLE}
          onClick={action.onClick}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
