import React, { useEffect, useState } from 'react';
import type { ActiveFilters, ActiveSession, Incident, RiskLevel } from '../../types';
import { THEME } from '../../constants/rules';
import { EmptyState } from '../ui';
import SummaryCards from './SummaryCards';
import RiskDistributionChart from './RiskDistributionChart';
import TimelineChart from './TimelineChart';
import FilterBar from './FilterBar';
import TopIPsTable from './TopIPsTable';
import TopEventTypesTable from './TopEventTypesTable';
import AlertBanner from './AlertBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardProps {
  session: ActiveSession;
  filteredIncidents: Incident[];
  incidentsByLevel: Record<RiskLevel, number>;
  onFiltersChange: (filters: Partial<ActiveFilters>) => void;
  onResetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Responsive hook — detects narrow viewport for collapsing 2-col grids
// ---------------------------------------------------------------------------

function useIsNarrow(breakpoint = 640): boolean {
  const [isNarrow, setIsNarrow] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    function handleChange(e: MediaQueryListEvent) {
      setIsNarrow(e.matches);
    }

    // Safari < 14 doesn't support addEventListener on MediaQueryList
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
    } else {
      mql.addListener(handleChange); // eslint-disable-line @typescript-eslint/no-deprecated
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handleChange);
      } else {
        mql.removeListener(handleChange); // eslint-disable-line @typescript-eslint/no-deprecated
      }
    };
  }, [breakpoint]);

  return isNarrow;
}

// ---------------------------------------------------------------------------
// SVG shield icon for the idle empty state
// ---------------------------------------------------------------------------

const ShieldIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers — check whether any non-default filter is active
// ---------------------------------------------------------------------------

function hasActiveFilters(filters: ActiveSession['filters']): boolean {
  return (
    filters.riskLevels.length > 0 ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null ||
    filters.sourceIP.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Sub-component: FilteredBanner — shown when filters are active
// ---------------------------------------------------------------------------

const FilteredBanner: React.FC = () => {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: `${THEME.accent}1A`, // 10 % opacity
    border: `1px solid ${THEME.accent}55`,
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    color: THEME.accent,
    fontWeight: 500,
    alignSelf: 'flex-start',
  };

  return (
    <div style={style} role="status" aria-live="polite">
      {/* Filter funnel icon */}
      <svg
        aria-hidden="true"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      Mostrando resultados filtrados
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component: Dashboard
// ---------------------------------------------------------------------------

/**
 * Contenedor principal del dashboard.
 *
 * Renderiza uno de tres estados:
 * 1. **idle** — EmptyState con instrucciones de inicio.
 * 2. **ready + sin incidentes** — SummaryCards con ceros + mensaje informativo.
 * 3. **ready + con incidentes** — layout completo con tarjetas, gráficos y tablas.
 *
 * En todos los estados con datos muestra la FilterBar encima del contenido.
 * El layout de dos columnas colapsa a una columna en viewports < 640 px,
 * implementado con flexbox (`flexWrap: 'wrap'` + `flex: '1 1 300px'`)
 * para no depender de media queries en estilos inline.
 */
const Dashboard: React.FC<DashboardProps> = ({
  session,
  filteredIncidents,
  incidentsByLevel,
  onFiltersChange,
  onResetFilters,
}) => {
  const isNarrow = useIsNarrow(640);
  const isReady = session.status === 'ready';
  const filtersActive = isReady && hasActiveFilters(session.filters);

  // ── 1. Idle state ────────────────────────────────────────────────────────
  if (session.status === 'idle') {
    return (
      <EmptyState
        icon={<ShieldIcon />}
        title="Bienvenido a SOC Insight"
        description="Cargue un archivo de registros para comenzar el análisis"
        style={{ padding: '5rem 1.5rem' }}
      />
    );
  }

  // ── Processing states ────────────────────────────────────────────────────
  if (!isReady) {
    // While validating / parsing / normalizing / detecting we still render
    // a neutral empty shell so the layout doesn't jump.
    return (
      <EmptyState
        title="Procesando…"
        description="El análisis está en progreso, por favor espere"
        style={{ padding: '5rem 1.5rem' }}
      />
    );
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────
  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  };

  // Two-column grid that collapses to single column on narrow viewports.
  // Uses flex instead of CSS grid so it works without media queries.
  const twoColStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.25rem',
  };

  const twoColItemStyle: React.CSSProperties = {
    flex: isNarrow ? '1 1 100%' : '1 1 300px',
    minWidth: 0, // prevents overflow in flex children
  };

  // ── 2. Ready + no incidents ──────────────────────────────────────────────
  if (session.incidents.length === 0) {
    const zerosByLevel: Record<RiskLevel, number> = {
      CRÍTICO: 0,
      ALTO: 0,
      MEDIO: 0,
      BAJO: 0,
      INFORMATIVO: 0,
    };

    return (
      <div style={wrapperStyle}>
        {/* FilterBar is still useful to reset any leftover filters */}
        <FilterBar
          filters={session.filters}
          onFiltersChange={onFiltersChange}
          onReset={onResetFilters}
        />
        <SummaryCards
          totalRecords={session.totalRecords}
          totalIncidents={0}
          incidentsByLevel={zerosByLevel}
        />
        <EmptyState
          title="Sin incidentes detectados"
          description="No se encontraron incidentes en los registros analizados"
        />
      </div>
    );
  }

  // ── 3. Ready + with incidents ────────────────────────────────────────────
  return (
    <div style={wrapperStyle}>

      {/* Filter bar */}
      <FilterBar
        filters={session.filters}
        onFiltersChange={onFiltersChange}
        onReset={onResetFilters}
      />

      {/* Filtered results banner */}
      {filtersActive && <FilteredBanner />}

      {/* Alert banner — shown only when incidents exist */}
      <AlertBanner
        incidentsByLevel={incidentsByLevel}
        totalIncidents={session.incidents.length}
        totalRecords={session.totalRecords}
      />

      {/* Summary cards */}
      <SummaryCards
        totalRecords={session.totalRecords}
        totalIncidents={session.incidents.length}
        incidentsByLevel={incidentsByLevel}
      />

      {/* Row 1: RiskDistributionChart + TimelineChart */}
      <div style={twoColStyle}>
        <div style={twoColItemStyle}>
          <RiskDistributionChart incidents={filteredIncidents} />
        </div>
        <div style={twoColItemStyle}>
          <TimelineChart records={session.records} />
        </div>
      </div>

      {/* Row 2: TopIPsTable + TopEventTypesTable */}
      <div style={twoColStyle}>
        <div style={twoColItemStyle}>
          <TopIPsTable records={session.records} />
        </div>
        <div style={twoColItemStyle}>
          <TopEventTypesTable records={session.records} />
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
