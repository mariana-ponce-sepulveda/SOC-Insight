import React from 'react';
import Card from '../../ui/Card';
import { THEME } from '../../../constants/rules';
import { calcTopEventTypes } from '../../../lib/stats';
import type { NormalizedRecord } from '../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopEventTypesTableProps {
  records: NormalizedRecord[];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: THEME.textMuted,
  borderBottom: `1px solid ${THEME.border}`,
  textAlign: 'left',
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  color: THEME.textPrimary,
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const emptyStyle: React.CSSProperties = {
  color: THEME.textMuted,
  fontSize: '0.875rem',
  textAlign: 'center',
  padding: '1rem 0',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tabla que muestra los 10 tipos de evento más frecuentes, calculados a
 * partir de los registros normalizados. Si no hay tipos disponibles,
 * muestra un mensaje informativo.
 */
const TopEventTypesTable: React.FC<TopEventTypesTableProps> = ({ records }) => {
  const items = calcTopEventTypes(records, 10);

  return (
    <Card title="Tipos de evento frecuentes">
      {items.length === 0 ? (
        <p style={emptyStyle}>No hay datos de tipo de evento disponibles</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Tipo de evento</th>
              <th style={thRightStyle}>Registros</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const rowBg = index % 2 === 0
                ? 'transparent'
                : 'rgba(255, 255, 255, 0.03)';
              return (
                <tr key={item.value} style={{ backgroundColor: rowBg }}>
                  <td style={tdStyle}>{item.value}</td>
                  <td style={tdRightStyle}>{item.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
};

export default TopEventTypesTable;
