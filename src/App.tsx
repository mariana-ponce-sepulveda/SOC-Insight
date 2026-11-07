/**
 * App.tsx — SOC Incident Analyzer
 *
 * Componente raíz de la aplicación. Integra todos los módulos:
 *   - Header fijo con icono de escudo, título y subtítulo
 *   - Navegación por tabs: Cargar Archivo | Dashboard | Incidentes | Exportar
 *   - Conexión completa al store Zustand (sessionStore)
 *   - Layout responsivo centrado en 1280px, fondo THEME.background
 */

import React, { useState, useEffect } from 'react';
import { THEME } from './constants/rules';
import { useSessionStore } from './store/sessionStore';
import FileUploader from './components/FileUploader';
import Dashboard from './components/Dashboard';
import IncidentList from './components/IncidentList';
const PDFGenerator = React.lazy(() => import('./components/PDFReport/PDFGenerator'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'upload' | 'dashboard' | 'incidents' | 'export';

interface Tab {
  id: TabId;
  label: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Shield icon (header)
// ---------------------------------------------------------------------------

const ShieldIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={28}
    height={28}
    viewBox="0 0 24 24"
    fill="none"
    stroke={THEME.accent}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

// ---------------------------------------------------------------------------
// Inject global base styles once
// ---------------------------------------------------------------------------

const GLOBAL_STYLE_ID = '__soc-global-style__';
function injectGlobalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background-color: ${THEME.background};
      color: ${THEME.textPrimary};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
                   Roboto, Oxygen, Ubuntu, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    /* Remove focus-visible outline only for mouse clicks */
    :focus:not(:focus-visible) { outline: none; }
    :focus-visible { outline: 2px solid ${THEME.accent}; outline-offset: 2px; }
  `;
  document.head.appendChild(style);
}
injectGlobalStyles();

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App(): React.JSX.Element {
  const {
    status,
    progress,
    file,
    records,
    incidents,
    processingErrors,
    filters,
    error,
    loadFile,
    clearSession,
    setFilters,
    resetFilters,
    filteredIncidents,
    incidentsByRiskLevel,
  } = useSessionStore();

  // Active tab state — start on 'upload'
  const [activeTab, setActiveTab] = useState<TabId>('upload');

  // When analysis completes, auto-navigate to dashboard
  useEffect(() => {
    if (status === 'ready') {
      setActiveTab('dashboard');
    }
  }, [status]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const isReady = status === 'ready';

  // Build preview data from records (first 20 rows) when ready
  const previewData: { headers: string[]; rows: import('./types').RawRow[] } | null =
    isReady && records.length > 0
      ? (() => {
          // Extract headers from the union of all recognized fields + extras in records[0]
          const firstRecord = records[0];
          const recognizedHeaders = Object.keys(firstRecord.fields) as import('./types').RecognizedField[];
          const extraHeaders = Object.keys(firstRecord.extra);
          const headers = [...recognizedHeaders, ...extraHeaders];

          // Build RawRow objects from NormalizedRecord fields for preview (first 20)
          const previewRecords = records.slice(0, 20);
          const rows: import('./types').RawRow[] = previewRecords.map((rec) => {
            const row: import('./types').RawRow = {};
            // Use raw values for preview (original data)
            for (const field of recognizedHeaders) {
              const f = rec.fields[field];
              row[field] = f ? f.raw : '';
            }
            for (const key of extraHeaders) {
              row[key] = rec.extra[key] ?? '';
            }
            return row;
          });

          return { headers, rows };
        })()
      : null;

  // Info message about multiple sheets
  const infoMessage: string | null = (() => {
    if (!isReady) return null;
    // Check processingErrors for multiple-sheets notice
    const multiSheetError = processingErrors.find((e) =>
      e.message.toLowerCase().includes('hoja') ||
      e.message.toLowerCase().includes('sheet'),
    );
    if (multiSheetError) return multiSheetError.message;
    // Also check file metadata
    if (file?.multipleSheets) {
      return `El archivo contiene múltiples hojas. Solo se procesó la primera hoja: "${file.sheetName ?? 'Hoja 1'}".`;
    }
    return null;
  })();

  // Derived selectors (called once per render to avoid redundant calls)
  const currentFilteredIncidents = isReady ? filteredIncidents() : [];
  const currentIncidentsByLevel = isReady ? incidentsByRiskLevel() : {
    CRÍTICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0, INFORMATIVO: 0,
  };

  // Active session shape expected by Dashboard / PDFGenerator
  const session: import('./types').ActiveSession = {
    status,
    progress,
    file,
    totalRecords: records.length,
    records,
    incidents,
    processingErrors,
    filters,
    analysisTimestamp: useSessionStore.getState().analysisTimestamp,
  };

  // -------------------------------------------------------------------------
  // Tab definitions
  // -------------------------------------------------------------------------

  const tabs: Tab[] = [
    { id: 'upload',    label: 'Cargar Archivo' },
    { id: 'dashboard', label: 'Dashboard',   disabled: !isReady },
    { id: 'incidents', label: 'Incidentes',  disabled: !isReady },
    { id: 'export',    label: 'Exportar',    disabled: !isReady },
  ];

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------

  const appStyle: React.CSSProperties = {
    minHeight:       '100vh',
    backgroundColor: THEME.background,
    color:           THEME.textPrimary,
    display:         'flex',
    flexDirection:   'column',
  };

  const headerStyle: React.CSSProperties = {
    position:        'sticky',
    top:             0,
    zIndex:          100,
    backgroundColor: THEME.surface,
    borderBottom:    `1px solid ${THEME.border}`,
    padding:         '0 1rem',
  };

  const headerInnerStyle: React.CSSProperties = {
    maxWidth:      '1280px',
    margin:        '0 auto',
    height:        '64px',
    display:       'flex',
    alignItems:    'center',
    gap:           '0.75rem',
  };

  const headerTextStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           '1px',
  };

  const titleStyle: React.CSSProperties = {
    margin:     0,
    fontSize:   '1.125rem',
    fontWeight: 700,
    color:      THEME.textPrimary,
    lineHeight: 1.2,
  };

  const subtitleStyle: React.CSSProperties = {
    margin:   0,
    fontSize: '0.75rem',
    color:    THEME.textMuted,
  };

  const headerActionsStyle: React.CSSProperties = {
    marginLeft:  'auto',
    display:     'flex',
    alignItems:  'center',
    gap:         '0.5rem',
  };

  const clearBtnStyle: React.CSSProperties = {
    appearance:      'none',
    background:      'transparent',
    border:          `1px solid ${THEME.border}`,
    borderRadius:    '0.375rem',
    color:           THEME.textMuted,
    fontSize:        '0.8125rem',
    padding:         '0.375rem 0.75rem',
    cursor:          'pointer',
    transition:      'color 150ms ease, border-color 150ms ease',
    fontFamily:      'inherit',
  };

  const navStyle: React.CSSProperties = {
    backgroundColor: THEME.surface,
    borderBottom:    `1px solid ${THEME.border}`,
    padding:         '0 1rem',
  };

  const navInnerStyle: React.CSSProperties = {
    maxWidth:  '1280px',
    margin:    '0 auto',
    display:   'flex',
    gap:       '0',
  };

  const mainStyle: React.CSSProperties = {
    flex:    1,
    padding: '1.5rem 1rem',
  };

  const mainInnerStyle: React.CSSProperties = {
    maxWidth: '1280px',
    margin:   '0 auto',
  };

  function tabButtonStyle(tab: Tab): React.CSSProperties {
    const isActive = activeTab === tab.id;
    return {
      appearance:      'none',
      background:      'transparent',
      border:          'none',
      borderBottom:    isActive ? `2px solid ${THEME.accent}` : '2px solid transparent',
      color:           tab.disabled
        ? THEME.textMuted + '55'
        : isActive
        ? THEME.accent
        : THEME.textMuted,
      cursor:          tab.disabled ? 'not-allowed' : 'pointer',
      fontSize:        '0.9375rem',
      fontWeight:      isActive ? 600 : 400,
      padding:         '0.875rem 1rem',
      transition:      'color 150ms ease, border-color 150ms ease',
      whiteSpace:      'nowrap',
      fontFamily:      'inherit',
      outline:         'none',
    };
  }

  // -------------------------------------------------------------------------
  // Render tab content
  // -------------------------------------------------------------------------

  function renderTabContent() {
    switch (activeTab) {
      case 'upload':
        return (
          <FileUploader
            onFileSelect={loadFile}
            isLoading={
              status === 'validating' ||
              status === 'parsing' ||
              status === 'normalizing' ||
              status === 'detecting'
            }
            progress={progress}
            error={error}
            status={status}
            previewData={previewData}
            fileMetadata={file}
            infoMessage={infoMessage}
          />
        );

      case 'dashboard':
        return (
          <Dashboard
            session={session}
            filteredIncidents={currentFilteredIncidents}
            incidentsByLevel={currentIncidentsByLevel}
            onFiltersChange={setFilters}
            onResetFilters={resetFilters}
          />
        );

      case 'incidents':
        return (
          <IncidentList
            incidents={currentFilteredIncidents}
            filters={filters}
            onFiltersChange={setFilters}
            onResetFilters={resetFilters}
          />
        );

      case 'export':
        return (
          <React.Suspense fallback={<div style={{ color: THEME.textMuted, padding: '2rem', textAlign: 'center' }}>Cargando módulo de exportación…</div>}>
            <PDFGenerator
              session={session}
              incidents={currentFilteredIncidents}
              isReady={isReady}
            />
          </React.Suspense>
        );

      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={appStyle}>
      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <header style={headerStyle} role="banner">
        <div style={headerInnerStyle}>
          <ShieldIcon />
          <div style={headerTextStyle}>
            <h1 style={titleStyle}>SOC Incident Analyzer</h1>
            <p style={subtitleStyle}>Centro de Operaciones de Seguridad</p>
          </div>

          {/* Clear session button (visible when session active) */}
          {status !== 'idle' && (
            <div style={headerActionsStyle}>
              <button
                style={clearBtnStyle}
                onClick={() => {
                  clearSession();
                  setActiveTab('upload');
                }}
                aria-label="Limpiar sesión y cargar un nuevo archivo"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = THEME.textPrimary;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.textMuted;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = THEME.textMuted;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = THEME.border;
                }}
              >
                Nueva sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Tab navigation ───────────────────────────────────────────────── */}
      <nav style={navStyle} aria-label="Navegación principal">
        <div style={navInnerStyle} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              disabled={tab.disabled}
              style={tabButtonStyle(tab)}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={mainStyle} id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        <div style={mainInnerStyle}>
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
