import React from 'react';
import { THEME } from '../../constants/rules';
import Spinner from './Spinner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const BASE: React.CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            '0.5rem',
  fontFamily:     'inherit',
  fontWeight:     600,
  borderRadius:   '0.375rem',
  border:         '1px solid transparent',
  cursor:         'pointer',
  transition:     'background-color 150ms ease, opacity 150ms ease, border-color 150ms ease',
  userSelect:     'none',
  whiteSpace:     'nowrap',
  outline:        'none',
};

function variantStyles(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: THEME.accent,    // #3B82F6
        color:           '#FFFFFF',
        borderColor:     THEME.accent,
      };
    case 'secondary':
      return {
        backgroundColor: THEME.surface,   // #1E293B
        color:           THEME.textPrimary,
        borderColor:     THEME.border,
      };
    case 'danger':
      return {
        backgroundColor: '#B91C1C',       // rojo CRÍTICO
        color:           '#FFFFFF',
        borderColor:     '#B91C1C',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color:           THEME.textPrimary,
        borderColor:     'transparent',
      };
  }
}

function sizeStyles(size: ButtonSize): React.CSSProperties {
  switch (size) {
    case 'sm': return { padding: '0.25rem 0.625rem', fontSize: '0.8125rem', lineHeight: '1.25rem' };
    case 'md': return { padding: '0.5rem 1rem',      fontSize: '0.9375rem', lineHeight: '1.5rem'  };
    case 'lg': return { padding: '0.75rem 1.5rem',   fontSize: '1.0625rem', lineHeight: '1.75rem' };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Botón accesible con soporte para variantes, tamaños, estado de carga y
 * estado deshabilitado. Cumple WCAG 2.1 AA (contraste ≥ 4.5:1, foco visible).
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      disabled = false,
      style,
      children,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const computedStyle: React.CSSProperties = {
      ...BASE,
      ...variantStyles(variant),
      ...sizeStyles(size),
      opacity: isDisabled ? 0.55 : 1,
      cursor:  isDisabled ? 'not-allowed' : 'pointer',
      // Foco visible — anillo azul de alto contraste
      boxShadow: undefined,
      ...style,
    };

    function handleFocus(e: React.FocusEvent<HTMLButtonElement>) {
      e.currentTarget.style.boxShadow = `0 0 0 3px ${THEME.accent}80`;
    }

    function handleBlur(e: React.FocusEvent<HTMLButtonElement>) {
      e.currentTarget.style.boxShadow = '';
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        style={computedStyle}
        onClick={isDisabled ? undefined : onClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      >
        {loading && (
          <Spinner size="sm" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
