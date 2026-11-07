import React from 'react';
import type { ActiveFilters, RiskLevel } from '../../../types';
import { RISK_COLORS, THEME } from '../../../constants/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: Partial<ActiveFilters>) => void;
  onReset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RISK_LEVELS: RiskLevel[] = [
  'CRÍTICO',
  'ALTO',
  'MEDIO',
  'BAJO',
  'INFORMATIVO',
];

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  'CRÍTICO':     'Crítico',
  'ALTO':        'Alto',
  'MEDIO':       'Medio',
  'BAJO':        'Bajo',
  'INFORMATIVO': 'Informativo',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  backgroundColor: THEME.surface,
  border:          `1px solid ${THEME.border}`,
  borderRadius:    '0.5rem',
  padding:         '1rem 1.25rem',
  display:         'flex',
  flexWrap:        'wrap',
  gap:             '1rem',
  alignItems:      'flex-end',
};

const sectionStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           '0.375rem',
  minWidth:      0,
};

const labelStyle: React.CSSProperties = {
  fontSize:    '0.75rem',
  fontWeight:  600,
  color:       THEME.textMuted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  whiteSpace:  'nowrap',
};

const chipsRowStyle: React.CSSProperties = {
  display:    'flex',
  flexWrap:   'wrap',
  gap:        '0.375rem',
};

const dateInputsRowStyle: React.CSSProperties = {
  display:   'flex',
  gap:       '0.5rem',
  flexWrap:  'wrap',
  alignItems: 'center',
};

const dateInputStyle: React.CSSProperties = {
  backgroundColor: THEME.background,
  border:          `1px solid ${THEME.border}`,
  borderRadius:    '0.375rem',
  color:           THEME.textPrimary,
  fontSize:        '0.875rem',
  padding:         '0.375rem 0.5rem',
  outline:         'none',
  // coloring the calendar icon for dark mode (works in Chrome/Edge)
  colorScheme:     'dark',
  minWidth:        '7.5rem',
};

const textInputStyle: React.CSSProperties = {
  backgroundColor: THEME.background,
  border:          `1px solid ${THEME.border}`,
  borderRadius:    '0.375rem',
  color:           THEME.textPrimary,
  fontSize:        '0.875rem',
  padding:         '0.375rem 0.625rem',
  outline:         'none',
  width:           '12rem',
};

const resetButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border:          `1px solid ${THEME.border}`,
  borderRadius:    '0.375rem',
  color:           THEME.textMuted,
  cursor:          'pointer',
  fontSize:        '0.8125rem',
  fontWeight:      600,
  padding:         '0.375rem 0.875rem',
  whiteSpace:      'nowrap',
  transition:      'color 150ms ease, border-color 150ms ease',
};

// ---------------------------------------------------------------------------
// Sub-component: RiskChip
// ---------------------------------------------------------------------------

interface RiskChipProps {
  level: RiskLevel;
  active: boolean;
  onToggle: (level: RiskLevel) => void;
}

const RiskChip: React.FC<RiskChipProps> = ({ level, active, onToggle }) => {
  const colors = RISK_COLORS[level];

  const chipStyle: React.CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '0.25rem',
    padding:         '0.25rem 0.625rem',
    borderRadius:    '9999px',
    fontSize:        '0.8125rem',
    fontWeight:      600,
    cursor:          'pointer',
    userSelect:      'none',
    border:          '2px solid transparent',
    transition:      'opacity 150ms ease, box-shadow 150ms ease',
    // Active: filled with risk color; inactive: muted outline
    backgroundColor: active ? colors.bg  : `${colors.bg}22`,
    color:           active ? colors.text : colors.bg,
    borderColor:     active ? colors.bg  : `${colors.bg}66`,
    opacity:         1,
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(level);
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLSpanElement>) {
    e.currentTarget.style.boxShadow = `0 0 0 3px ${THEME.accent}80`;
  }

  function handleBlur(e: React.FocusEvent<HTMLSpanElement>) {
    e.currentTarget.style.boxShadow = '';
  }

  return (
    <span
      role="checkbox"
      aria-checked={active}
      aria-label={`Filtrar por nivel ${RISK_LEVEL_LABELS[level]}`}
      tabIndex={0}
      style={chipStyle}
      onClick={() => onToggle(level)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Checkmark indicator when active */}
      {active && (
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M1.5 5L4 7.5L8.5 2.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Main Component: FilterBar
// ---------------------------------------------------------------------------

/**
 * Barra de filtros del dashboard.
 *
 * Controles:
 * 1. Multi-select de RiskLevel mediante chips interactivos con colores de RISK_COLORS.
 * 2. Date range con dos <input type="date"> para "Desde" y "Hasta".
 * 3. Campo de texto para IP de origen.
 * 4. Botón "Limpiar filtros".
 *
 * Todas las actualizaciones son síncronas (sin debounce), cumpliendo el
 * requisito de respuesta ≤ 2 s. Cumple WCAG 2.1 AA (etiquetas, roles ARIA,
 * contraste, navegación por teclado).
 */
const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  onReset,
}) => {
  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleChipToggle(level: RiskLevel) {
    const current = filters.riskLevels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onFiltersChange({ riskLevels: next });
  }

  function handleDateFrom(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value || null;
    onFiltersChange({ dateRange: { from: value, to: filters.dateRange.to } });
  }

  function handleDateTo(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value || null;
    onFiltersChange({ dateRange: { from: filters.dateRange.from, to: value } });
  }

  function handleIPChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiltersChange({ sourceIP: e.target.value });
  }

  function handleResetHover(e: React.MouseEvent<HTMLButtonElement>) {
    (e.currentTarget as HTMLButtonElement).style.color = THEME.textPrimary;
    (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.textMuted;
  }

  function handleResetLeave(e: React.MouseEvent<HTMLButtonElement>) {
    (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted;
    (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.border;
  }

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = THEME.accent;
    e.currentTarget.style.boxShadow   = `0 0 0 3px ${THEME.accent}40`;
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = THEME.border;
    e.currentTarget.style.boxShadow   = '';
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const fromValue = filters.dateRange.from ?? '';
  const toValue   = filters.dateRange.to   ?? '';

  return (
    <div
      style={containerStyle}
      role="search"
      aria-label="Filtros del dashboard"
    >
      {/* ── Section 1: Risk level chips ─────────────────────────────────── */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-risk-label">
          Nivel de riesgo
        </span>
        <div
          style={chipsRowStyle}
          role="group"
          aria-labelledby="filter-risk-label"
        >
          {RISK_LEVELS.map((level) => (
            <RiskChip
              key={level}
              level={level}
              active={filters.riskLevels.includes(level)}
              onToggle={handleChipToggle}
            />
          ))}
        </div>
      </div>

      {/* ── Section 2: Date range ────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <span style={labelStyle} id="filter-date-label">
          Rango de fecha
        </span>
        <div
          style={dateInputsRowStyle}
          role="group"
          aria-labelledby="filter-date-label"
        >
          <label htmlFor="filter-date-from" style={labelStyle}>
            Desde
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={fromValue}
            onChange={handleDateFrom}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            style={dateInputStyle}
            aria-label="Filtrar desde fecha"
            max={toValue || undefined}
          />
          <label htmlFor="filter-date-to" style={labelStyle}>
            Hasta
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={toValue}
            onChange={handleDateTo}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            style={dateInputStyle}
            aria-label="Filtrar hasta fecha"
            min={fromValue || undefined}
          />
        </div>
      </div>

      {/* ── Section 3: Source IP ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <label htmlFor="filter-source-ip" style={labelStyle}>
          IP de origen
        </label>
        <input
          id="filter-source-ip"
          type="text"
          value={filters.sourceIP}
          onChange={handleIPChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={textInputStyle}
          placeholder="Filtrar por IP…"
          aria-label="Filtrar por IP de origen"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* ── Section 4: Reset button ──────────────────────────────────────── */}
      <div style={{ ...sectionStyle, justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={resetButtonStyle}
          onClick={onReset}
          onMouseEnter={handleResetHover}
          onMouseLeave={handleResetLeave}
          aria-label="Limpiar todos los filtros"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
