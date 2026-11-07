import React, { useEffect, useRef, useCallback, useId } from 'react';
import { THEME } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Ancho máximo del modal, por defecto 560px */
  maxWidth?: number | string;
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const OVERLAY_STYLE: React.CSSProperties = {
  position:        'fixed',
  inset:           0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  zIndex:          1000,
  padding:         '1rem',
};

const DIALOG_BASE: React.CSSProperties = {
  backgroundColor: THEME.surface,
  border:          `1px solid ${THEME.border}`,
  borderRadius:    '0.5rem',
  width:           '100%',
  display:         'flex',
  flexDirection:   'column',
  maxHeight:       '90vh',
  overflow:        'hidden',
  outline:         'none',         // gestionamos foco manualmente
};

const HEADER_STYLE: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'space-between',
  padding:        '1rem 1.25rem',
  borderBottom:   `1px solid ${THEME.border}`,
  flexShrink:     0,
};

const TITLE_STYLE: React.CSSProperties = {
  margin:     0,
  fontSize:   '1.0625rem',
  fontWeight: 600,
  color:      THEME.textPrimary,
  lineHeight: 1.4,
};

const CLOSE_BTN_STYLE: React.CSSProperties = {
  background:   'transparent',
  border:       'none',
  cursor:       'pointer',
  color:        THEME.textMuted,
  padding:      '0.25rem',
  borderRadius: '0.25rem',
  display:      'flex',
  alignItems:   'center',
  justifyContent:'center',
  fontSize:     '1.25rem',
  lineHeight:   1,
  transition:   'color 150ms ease',
};

const BODY_STYLE: React.CSSProperties = {
  padding:   '1.25rem',
  overflowY: 'auto',
  flex:      1,
  color:     THEME.textPrimary,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retorna todos los elementos focusables dentro de un elemento */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(el => !el.closest('[hidden]'));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal accesible con trampa de foco (focus trap) y cierre con Escape.
 *
 * Accesibilidad:
 * - role="dialog", aria-modal="true", aria-labelledby apuntando al h2 del título.
 * - Foco se mueve al dialog al abrirse; se restaura al elemento previo al cerrarse.
 * - Tecla Escape cierra el modal.
 * - Tab / Shift+Tab atrapados dentro del dialog.
 * - Clic en overlay cierra el modal.
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 560,
}) => {
  const titleId   = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // ── Guardar foco anterior y moverlo al dialog al abrir ──────────────────
  useEffect(() => {
    if (isOpen) {
      prevFocus.current = document.activeElement as HTMLElement;
      // Pequeño diferido para que el DOM esté montado
      const raf = requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else {
      prevFocus.current?.focus();
    }
  }, [isOpen]);

  // ── Bloquear scroll del body mientras el modal está abierto ─────────────
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  // ── Teclado: Escape y focus-trap ────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = getFocusable(dialogRef.current);
        if (focusable.length === 0) { e.preventDefault(); return; }

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  const dialogStyle: React.CSSProperties = {
    ...DIALOG_BASE,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
  };

  return (
    <div
      style={OVERLAY_STYLE}
      onClick={(e) => {
        // Cerrar solo si el clic fue directamente en el overlay
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={true}
        aria-labelledby={titleId}
        style={dialogStyle}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        // Evitar que el clic dentro del dialog propague al overlay
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={HEADER_STYLE}>
          <h2 id={titleId} style={TITLE_STYLE}>{title}</h2>
          <button
            type="button"
            aria-label="Cerrar modal"
            style={CLOSE_BTN_STYLE}
            onClick={onClose}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = THEME.textPrimary; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted; }}
          >
            {/* ✕ como SVG para mejor compatibilidad cross-browser */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <line x1="2" y1="2" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="2" x2="2"  y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={BODY_STYLE}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
