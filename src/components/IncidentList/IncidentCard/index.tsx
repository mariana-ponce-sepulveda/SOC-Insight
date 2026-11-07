import React, { useState } from 'react';
import { Badge, Card } from '../../ui';
import { THEME, RISK_COLORS } from '../../../constants/rules';
import type { Incident, NormalizedRecord, RecognizedField } from '../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentCardProps {
  incident: Incident;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea un timestamp ISO 8601 a una cadena legible en español */
function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-ES', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/** Recoge los campos disponibles (no 'absent') de un NormalizedRecord */
function getAvailableFields(
  record: NormalizedRecord
): { field: string; value: string }[] {
  const result: { field: string; value: string }[] = [];

  const recognizedOrder: RecognizedField[] = [
    'timestamp', 'sourceIP', 'destinationIP', 'user',
    'eventType', 'sourceSystem', 'description', 'status', 'severity',
  ];

  for (const field of recognizedOrder) {
    const fv = record.fields[field];
    if (!fv || fv.status === 'absent') continue;
    const val = fv.normalized !== undefined && fv.normalized !== null
      ? String(fv.normalized)
      : String(fv.raw);
    result.push({ field, value: val });
  }

  // Columnas extra
  for (const [key, val] of Object.entries(record.extra)) {
    if (val === undefined || val === null || String(val).trim() === '') continue;
    result.push({ field: key, value: String(val) });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Tabla de evidencias para un registro individual */
const EvidenceRow: React.FC<{ record: NormalizedRecord; index: number }> = ({
  record,
  index,
}) => {
  const fields = getAvailableFields(record);

  const rowStyle: React.CSSProperties = {
    display:         'grid',
    gridTemplateColumns: '1fr 2fr',
    gap:             '0.25rem 0.75rem',
    padding:         '0.5rem 0.75rem',
    backgroundColor: index % 2 === 0 ? `${THEME.background}88` : 'transparent',
    borderRadius:    '0.25rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize:    '0.7rem',
    fontWeight:  600,
    color:       THEME.textMuted,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    wordBreak:   'break-word',
  };

  const valueStyle: React.CSSProperties = {
    fontSize:  '0.75rem',
    color:     THEME.textPrimary,
    wordBreak: 'break-all',
  };

  if (fields.length === 0) {
    return (
      <div style={rowStyle}>
        <span style={{ ...labelStyle, gridColumn: '1 / -1', color: THEME.textMuted }}>
          Sin campos disponibles
        </span>
      </div>
    );
  }

  return (
    <div style={{ ...rowStyle, display: 'block' }}>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap:                 '0.375rem 1rem',
        }}
      >
        {fields.map(({ field, value }) => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            <span style={labelStyle}>{field}</span>
            <span style={valueStyle}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Tarjeta de incidente individual con header, motivo, reglas activadas y
 * sección expandible de registros de respaldo.
 */
const IncidentCard: React.FC<IncidentCardProps> = ({ incident }) => {
  const [expanded, setExpanded]       = useState(false);
  const [showAllRecords, setShowAll]  = useState(false);

  const { id, riskLevel, reason, triggeredRules, evidenceRecords, firstTimestamp } = incident;

  const shortId        = id.slice(0, 8).toUpperCase();
  const riskColor      = RISK_COLORS[riskLevel];
  const totalRecords   = evidenceRecords.length;
  const MAX_VISIBLE    = 5;
  const visibleRecords = showAllRecords
    ? evidenceRecords
    : evidenceRecords.slice(0, MAX_VISIBLE);

  // ── Styles ──────────────────────────────────────────────────────────────

  const headerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.75rem',
    flexWrap:       'wrap',
  };

  const idStyle: React.CSSProperties = {
    fontFamily:  'monospace',
    fontSize:    '0.8rem',
    color:       THEME.textMuted,
    letterSpacing: '0.05em',
  };

  const dateStyle: React.CSSProperties = {
    fontSize:   '0.78rem',
    color:      THEME.textMuted,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  };

  const reasonStyle: React.CSSProperties = {
    fontSize:   '0.9rem',
    color:      THEME.textPrimary,
    lineHeight: 1.5,
  };

  const chipContainerStyle: React.CSSProperties = {
    display:   'flex',
    flexWrap:  'wrap',
    gap:       '0.375rem',
    marginTop: '0.25rem',
  };

  const chipStyle: React.CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    padding:         '0.125rem 0.5rem',
    borderRadius:    '0.25rem',
    fontSize:        '0.7rem',
    fontWeight:      600,
    backgroundColor: `${riskColor.bg}22`,
    color:           riskColor.bg,
    border:          `1px solid ${riskColor.bg}55`,
    whiteSpace:      'nowrap',
  };

  const footerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '0.5rem',
    marginTop:      '0.25rem',
    paddingTop:     '0.75rem',
    borderTop:      `1px solid ${THEME.border}`,
  };

  const recordCountStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color:    THEME.textMuted,
  };

  const toggleBtnStyle: React.CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '0.375rem',
    padding:         '0.25rem 0.75rem',
    borderRadius:    '0.375rem',
    fontSize:        '0.78rem',
    fontWeight:      600,
    cursor:          'pointer',
    border:          `1px solid ${THEME.border}`,
    backgroundColor: 'transparent',
    color:           THEME.textPrimary,
    transition:      'background-color 0.15s',
  };

  const evidenceSectionStyle: React.CSSProperties = {
    marginTop:    '0.75rem',
    padding:      '0.75rem',
    borderRadius: '0.375rem',
    border:       `1px solid ${THEME.border}`,
    backgroundColor: THEME.background,
    display:      'flex',
    flexDirection: 'column',
    gap:          '0.5rem',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize:    '0.75rem',
    fontWeight:  700,
    color:       THEME.textMuted,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  };

  const showMoreBtnStyle: React.CSSProperties = {
    alignSelf:       'flex-start',
    padding:         '0.25rem 0.75rem',
    borderRadius:    '0.375rem',
    fontSize:        '0.75rem',
    fontWeight:      600,
    cursor:          'pointer',
    border:          `1px solid ${THEME.accent}55`,
    backgroundColor: `${THEME.accent}11`,
    color:           THEME.accent,
    marginTop:       '0.25rem',
  };

  const cardStyle: React.CSSProperties = {
    borderLeft: `3px solid ${riskColor.bg}`,
  };

  return (
    <Card style={cardStyle}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={headerStyle}>
        <Badge riskLevel={riskLevel} aria-label={`Nivel de riesgo: ${riskLevel}`} />
        <span style={idStyle} title={`ID completo: ${id}`}>#{shortId}</span>
        <span style={dateStyle}>
          🕐 {formatTimestamp(firstTimestamp)}
        </span>
      </div>

      {/* ── Motivo ──────────────────────────────────────────────────── */}
      <p style={reasonStyle}>{reason}</p>

      {/* ── Reglas activadas ────────────────────────────────────────── */}
      {triggeredRules.length > 0 && (
        <div role="list" aria-label="Reglas activadas">
          <div style={chipContainerStyle}>
            {triggeredRules.map((rule) => (
              <span
                key={rule.ruleId}
                role="listitem"
                style={chipStyle}
                title={`Severidad: ${rule.severity}`}
              >
                {rule.ruleName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Pie ─────────────────────────────────────────────────────── */}
      <div style={footerStyle}>
        <span style={recordCountStyle}>
          {totalRecords} {totalRecords === 1 ? 'registro de respaldo' : 'registros de respaldo'}
        </span>
        {totalRecords > 0 && (
          <button
            type="button"
            style={toggleBtnStyle}
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={`evidence-${id}`}
          >
            {expanded ? '▲ Colapsar' : '▼ Ver evidencias'}
          </button>
        )}
      </div>

      {/* ── Sección expandible de evidencias ────────────────────────── */}
      {expanded && (
        <section
          id={`evidence-${id}`}
          style={evidenceSectionStyle}
          aria-label="Registros de respaldo"
        >
          <p style={sectionHeaderStyle}>
            Registros de respaldo ({totalRecords})
          </p>

          {visibleRecords.map((record, idx) => (
            <EvidenceRow key={record._rowIndex} record={record} index={idx} />
          ))}

          {!showAllRecords && totalRecords > MAX_VISIBLE && (
            <button
              type="button"
              style={showMoreBtnStyle}
              onClick={() => setShowAll(true)}
            >
              Ver más ({totalRecords - MAX_VISIBLE} registros adicionales)
            </button>
          )}

          {showAllRecords && totalRecords > MAX_VISIBLE && (
            <button
              type="button"
              style={{ ...showMoreBtnStyle, border: `1px solid ${THEME.border}`, backgroundColor: 'transparent', color: THEME.textMuted }}
              onClick={() => setShowAll(false)}
            >
              Ver menos
            </button>
          )}
        </section>
      )}
    </Card>
  );
};

export default IncidentCard;
