/**
 * PDFGenerator — SOC Incident Analyzer
 *
 * Panel de exportación con tres acciones:
 *   1. Generar y descargar informe PDF
 *   2. Exportar incidentes a CSV
 *   3. Exportar incidentes a Excel (.xlsx)
 */

import React, { useState } from 'react';
import { THEME } from '../../constants/rules';
import { generatePDF } from '../../lib/pdfGenerator';
import { exportToCSV, exportToExcel, downloadFile } from '../../lib/exporter';
import { Button, Spinner } from '../ui';
import type { ActiveSession, Incident } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PDFGeneratorProps {
  session: ActiveSession;
  incidents: Incident[];
  /** session.status === 'ready' */
  isReady: boolean;
}

// ---------------------------------------------------------------------------
// PDF generation state machine
// ---------------------------------------------------------------------------

type PDFState =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'ready'; buffer: ArrayBuffer }
  | { phase: 'error'; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Muestra los botones de exportación (PDF, CSV, Excel) y gestiona el ciclo
 * de vida de la generación del PDF (idle → generating → ready / error).
 */
const PDFGenerator: React.FC<PDFGeneratorProps> = ({ session, incidents, isReady }) => {
  const [pdfState, setPdfState] = useState<PDFState>({ phase: 'idle' });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handleGeneratePDF() {
    setPdfState({ phase: 'generating' });
    try {
      const blob = await generatePDF(session, incidents);
      const buffer = await blob.arrayBuffer();
      setPdfState({ phase: 'ready', buffer });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error desconocido al generar el PDF.';
      setPdfState({ phase: 'error', message });
    }
  }

  function handleDownloadPDF() {
    if (pdfState.phase !== 'ready') return;
    downloadFile(pdfState.buffer, 'informe-soc.pdf', 'application/pdf');
  }

  function handleExportCSV() {
    const csv = exportToCSV(incidents);
    downloadFile(csv, 'incidentes.csv', 'text/csv;charset=utf-8');
  }

  function handleExportExcel() {
    const xlsx = exportToExcel(incidents);
    downloadFile(
      xlsx,
      'incidentes.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }

  function handleResetPDF() {
    setPdfState({ phase: 'idle' });
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderPDFButton() {
    switch (pdfState.phase) {
      case 'idle':
        return (
          <Button
            variant="primary"
            size="md"
            disabled={!isReady}
            onClick={handleGeneratePDF}
            aria-label="Generar informe PDF"
          >
            Generar Informe PDF
          </Button>
        );

      case 'generating':
        return (
          <Button
            variant="primary"
            size="md"
            disabled
            aria-label="Generando PDF…"
            aria-busy={true}
          >
            <Spinner size="sm" aria-hidden="true" />
            Generando PDF…
          </Button>
        );

      case 'ready':
        return (
          <Button
            variant="primary"
            size="md"
            onClick={handleDownloadPDF}
            aria-label="Descargar informe PDF"
          >
            ⬇ Descargar PDF
          </Button>
        );

      case 'error':
        return (
          <Button
            variant="secondary"
            size="md"
            onClick={handleResetPDF}
            aria-label="Reintentar generación de PDF"
          >
            Reintentar PDF
          </Button>
        );
    }
  }

  // -------------------------------------------------------------------------
  // Layout styles
  // -------------------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    backgroundColor: THEME.surface,
    border:          `1px solid ${THEME.border}`,
    borderRadius:    '0.5rem',
    padding:         '1.25rem',
    display:         'flex',
    flexDirection:   'column',
    gap:             '1rem',
  };

  const rowStyle: React.CSSProperties = {
    display:    'flex',
    flexWrap:   'wrap',
    gap:        '0.75rem',
    alignItems: 'center',
  };

  const hintStyle: React.CSSProperties = {
    fontSize:  '0.875rem',
    color:     THEME.textMuted,
    margin:    0,
  };

  const errorStyle: React.CSSProperties = {
    fontSize:    '0.875rem',
    color:       '#F87171', // rojo claro legible en fondo oscuro
    margin:      0,
    fontWeight:  500,
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <section style={containerStyle} aria-label="Panel de exportación">
      {/* Hint when not ready */}
      {!isReady && (
        <p style={hintStyle} role="status">
          Cargue un archivo para habilitar la exportación.
        </p>
      )}

      {/* Button row */}
      <div style={rowStyle}>
        {/* PDF button (state machine) */}
        {renderPDFButton()}

        {/* CSV export */}
        <Button
          variant="secondary"
          size="md"
          disabled={!isReady}
          onClick={handleExportCSV}
          aria-label="Exportar incidentes a CSV"
        >
          Exportar CSV
        </Button>

        {/* Excel export */}
        <Button
          variant="secondary"
          size="md"
          disabled={!isReady}
          onClick={handleExportExcel}
          aria-label="Exportar incidentes a Excel"
        >
          Exportar Excel
        </Button>
      </div>

      {/* PDF error message */}
      {pdfState.phase === 'error' && (
        <p style={errorStyle} role="alert" aria-live="assertive">
          {pdfState.message}
        </p>
      )}
    </section>
  );
};

export default PDFGenerator;
