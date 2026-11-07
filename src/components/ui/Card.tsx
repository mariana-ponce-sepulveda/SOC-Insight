import React from 'react';
import { THEME } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardProps {
  children: React.ReactNode;
  /** Clase CSS adicional para estilos externos */
  className?: string;
  /** Título opcional mostrado en la parte superior con separador */
  title?: string;
  /** Overrides de estilo inline */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Contenedor con fondo surface, borde y padding del tema oscuro.
 * Sirve de base estructural para secciones del dashboard, tarjetas de
 * incidente y paneles de configuración.
 */
const Card: React.FC<CardProps> = ({ children, className, title, style }) => {
  const containerStyle: React.CSSProperties = {
    backgroundColor: THEME.surface,      // #1E293B
    border:          `1px solid ${THEME.border}`, // #334155
    borderRadius:    '0.5rem',
    padding:         '1.25rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             title ? '0.875rem' : undefined,
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    margin:      0,
    padding:     0,
    fontSize:    '1rem',
    fontWeight:  600,
    color:       THEME.textPrimary,
    lineHeight:  1.4,
    paddingBottom: '0.75rem',
    borderBottom:  `1px solid ${THEME.border}`,
  };

  return (
    <div
      className={className}
      style={containerStyle}
    >
      {title && (
        <h3 style={titleStyle}>{title}</h3>
      )}
      {children}
    </div>
  );
};

export default Card;
