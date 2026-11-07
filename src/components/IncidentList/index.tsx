import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Incident, ActiveFilters } from '../../types';
import { THEME } from '../../constants/rules';
import FilterBar from '../Dashboard/FilterBar';
import IncidentCard from './IncidentCard';
import EmptyState from '../ui/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentListProps {
  incidents: Incident[];
  filters: ActiveFilters;
  onFiltersChange: (filters: Partial<ActiveFilters>) => void;
  onResetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           '1rem',
  width:         '100%',
};

const countStyle: React.CSSProperties = {
  fontSize:   '0.875rem',
  color:      THEME.textMuted,
  fontWeight: 500,
  padding:    '0 0.25rem',
};

const scrollContainerStyle: React.CSSProperties = {
  maxHeight:   '600px',
  overflow:    'auto',
  border:      `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  backgroundColor: THEME.background,
};

const listInnerStyle: React.CSSProperties = {
  position: 'relative',
  width:    '100%',
};

// ---------------------------------------------------------------------------
// Helper: Check if any filter is active
// ---------------------------------------------------------------------------

function hasActiveFilters(filters: ActiveFilters): boolean {
  return (
    filters.riskLevels.length > 0 ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null ||
    filters.sourceIP.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Lista virtualizada de incidentes con FilterBar en la parte superior.
 *
 * Implementa virtualización con @tanstack/react-virtual para manejar listas
 * largas eficientemente. Muestra EmptyState apropiado cuando no hay incidentes
 * (con o sin filtros activos).
 *
 * Props:
 * - incidents: Lista de incidentes a mostrar (ya filtrados por el store)
 * - filters: Filtros activos actuales
 * - onFiltersChange: Callback para actualizar filtros
 * - onResetFilters: Callback para limpiar todos los filtros
 */
const IncidentList: React.FC<IncidentListProps> = ({
  incidents,
  filters,
  onFiltersChange,
  onResetFilters,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Virtualizer setup
  // -------------------------------------------------------------------------

  const virtualizer = useVirtualizer({
    count: incidents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180, // Estimated height per incident card
    overscan: 5, // Number of items to render outside visible area
  });

  const virtualItems = virtualizer.getVirtualItems();

  // -------------------------------------------------------------------------
  // Determine what to show
  // -------------------------------------------------------------------------

  const totalIncidents = incidents.length;
  const hasFilters = hasActiveFilters(filters);

  // Empty state when no incidents
  if (totalIncidents === 0) {
    const emptyContent = hasFilters ? (
      <EmptyState
        icon="🔍"
        title="No hay incidentes que coincidan con los filtros seleccionados"
        description="Intenta ajustar los filtros para ver más resultados"
        action={{
          label: 'Limpiar filtros',
          onClick: onResetFilters,
        }}
      />
    ) : (
      <EmptyState
        icon="✓"
        title="No se detectaron incidentes en el análisis"
        description="El análisis se completó exitosamente sin detectar incidentes de seguridad"
      />
    );

    return (
      <div style={containerStyle}>
        <FilterBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          onReset={onResetFilters}
        />
        {emptyContent}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render virtualized list
  // -------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* FilterBar at the top */}
      <FilterBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={onResetFilters}
      />

      {/* Count of visible incidents */}
      <div style={countStyle} role="status" aria-live="polite">
        Mostrando {totalIncidents} {totalIncidents === 1 ? 'incidente' : 'incidentes'}
      </div>

      {/* Virtualized scrollable container */}
      <div
        ref={parentRef}
        style={scrollContainerStyle}
        role="feed"
        aria-label="Lista de incidentes"
        aria-busy="false"
      >
        <div
          style={{
            ...listInnerStyle,
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const incident = incidents[virtualItem.index];
            return (
              <div
                key={incident.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                  padding: '0.5rem',
                }}
              >
                <IncidentCard incident={incident} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IncidentList;
