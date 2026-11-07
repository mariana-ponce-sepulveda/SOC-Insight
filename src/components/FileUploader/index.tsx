/**
 * FileUploader — Componente de carga de archivos con drag-and-drop.
 *
 * Características:
 *  - Zona drag-and-drop con feedback visual (hover/drag)
 *  - Botón "Seleccionar archivo" que abre el file picker
 *  - Validación inmediata de extensión y tamaño (validateExtension + validateSize)
 *  - Muestra nombre + tamaño formateado tras seleccionar archivo válido
 *  - Barra de progreso (0-100 %) visible mientras isLoading
 *  - Mensaje informativo para múltiples hojas
 *  - Vista previa: tabla con headers y primeras filas cuando previewData disponible
 *  - Mensajes de error en rojo cuando error !== null
 *  - Al cargar nuevo archivo se limpia el estado anterior
 *  - Accesible: aria-label en zona de drop, role="status" en progreso
 */

import React, { useRef, useState, useCallback } from 'react';
import { THEME } from '../../constants/rules';
import {
  validateExtension,
  validateSize,
  formatFileSize,
} from '../../lib/parser/validation';
import { Button, Spinner } from '../ui';
import type { AppError, FileMetadata, RawRow, SessionStatus } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  progress: number;
  error: AppError | null;
  status: SessionStatus;
  previewData?: { headers: string[]; rows: RawRow[] } | null;
  fileMetadata?: FileMetadata | null;
  infoMessage?: string | null;
}

// ---------------------------------------------------------------------------
// Inline style helpers
// ---------------------------------------------------------------------------

/** Inyectar animación de shimmer para la barra de progreso (una sola vez) */
const SHIMMER_KF_ID = '__soc-fu-shimmer__';
function injectShimmerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_KF_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_KF_ID;
  style.textContent = `
    @keyframes soc-fu-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
  `;
  document.head.appendChild(style);
}
injectShimmerKeyframes();

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Barra de progreso accesible */
function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress));

  const trackStyle: React.CSSProperties = {
    width: '100%',
    height: '0.5rem',
    backgroundColor: THEME.border,
    borderRadius: '9999px',
    overflow: 'hidden',
    marginTop: '0.75rem',
  };

  const fillStyle: React.CSSProperties = {
    height: '100%',
    width: `${pct}%`,
    background: `linear-gradient(90deg, ${THEME.accent}, #60a5fa, ${THEME.accent})`,
    backgroundSize: '200% auto',
    animation: pct < 100 ? 'soc-fu-shimmer 1.5s linear infinite' : 'none',
    borderRadius: '9999px',
    transition: 'width 200ms ease',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso de carga: ${pct}%`}
      style={trackStyle}
    >
      <div style={fillStyle} />
    </div>
  );
}

/** Texto de porcentaje junto a la barra */
function ProgressLabel({ progress, status }: { progress: number; status: SessionStatus }) {
  const labelMap: Partial<Record<SessionStatus, string>> = {
    validating:  'Validando archivo…',
    parsing:     'Leyendo archivo…',
    normalizing: 'Normalizando registros…',
    detecting:   'Detectando incidentes…',
  };
  const label = labelMap[status] ?? 'Procesando…';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '0.375rem',
        fontSize: '0.8125rem',
        color: THEME.textMuted,
      }}
    >
      <span>{label}</span>
      <span>{Math.round(progress)}%</span>
    </div>
  );
}

/** Vista previa de las primeras filas del archivo */
function PreviewTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: RawRow[];
}) {
  const MAX_PREVIEW_ROWS = 20;
  const displayRows = rows.slice(0, MAX_PREVIEW_ROWS);

  const containerStyle: React.CSSProperties = {
    marginTop: '1rem',
    overflowX: 'auto',
    borderRadius: '0.375rem',
    border: `1px solid ${THEME.border}`,
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
    color: THEME.textPrimary,
    minWidth: '100%',
  };

  const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    backgroundColor: `${THEME.border}99`,
    color: THEME.textMuted,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${THEME.border}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.4375rem 0.75rem',
    borderBottom: `1px solid ${THEME.border}22`,
    whiteSpace: 'nowrap',
    maxWidth: '14rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const captionStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: THEME.textMuted,
    marginTop: '0.375rem',
    textAlign: 'right',
  };

  return (
    <div>
      <p
        style={{
          margin: '0 0 0.375rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: THEME.textPrimary,
        }}
      >
        Vista previa
      </p>
      <div style={containerStyle}>
        <table style={tableStyle} aria-label="Vista previa de los datos del archivo">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={thStyle} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr
                key={ri}
                style={{
                  backgroundColor:
                    ri % 2 === 0 ? 'transparent' : `${THEME.border}22`,
                }}
              >
                {headers.map((h, ci) => (
                  <td key={ci} style={tdStyle} title={String(row[h] ?? '')}>
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_PREVIEW_ROWS && (
        <p style={captionStyle}>
          Mostrando {MAX_PREVIEW_ROWS} de {rows.length} filas
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  isLoading,
  progress,
  error,
  status,
  previewData,
  fileMetadata,
  infoMessage,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  /** Error de validación local (antes de invocar onFileSelect) */
  const [localError, setLocalError] = useState<AppError | null>(null);
  /** Nombre y tamaño del archivo seleccionado localmente (antes de procesar) */
  const [localFile, setLocalFile] = useState<{ name: string; size: string } | null>(null);

  // El error a mostrar puede ser el del store (prop) o el local
  const displayError = error ?? localError;

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFile = useCallback(
    (file: File) => {
      // Limpiar estado anterior
      setLocalError(null);
      setLocalFile(null);

      // 1. Validar extensión
      const extResult = validateExtension(file.name);
      if (!extResult.valid) {
        setLocalError(extResult.error);
        return;
      }

      // 2. Validar tamaño
      const sizeResult = validateSize(file.size);
      if (!sizeResult.valid) {
        setLocalError(sizeResult.error);
        return;
      }

      // 3. Mostrar metadatos locales
      setLocalFile({ name: file.name, size: formatFileSize(file.size) });

      // 4. Delegar al padre
      onFileSelect(file);
    },
    [onFileSelect],
  );

  // -------------------------------------------------------------------------
  // Drag-and-drop handlers
  // -------------------------------------------------------------------------

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Solo desactivar si el puntero deja el elemento raíz (no un hijo)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Resetear el input para permitir seleccionar el mismo archivo nuevamente
    e.target.value = '';
  }

  function handleSelectClick() {
    inputRef.current?.click();
  }

  // -------------------------------------------------------------------------
  // Styles (all inline, using THEME)
  // -------------------------------------------------------------------------

  const dropZoneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '2.5rem 1.5rem',
    border: `2px dashed ${isDragOver ? THEME.accent : displayError ? '#B91C1C' : THEME.border}`,
    borderRadius: '0.5rem',
    backgroundColor: isDragOver
      ? `${THEME.accent}14`
      : `${THEME.surface}`,
    cursor: isLoading ? 'not-allowed' : 'default',
    transition: 'border-color 150ms ease, background-color 150ms ease',
    textAlign: 'center',
    outline: 'none',
  };

  const iconStyle: React.CSSProperties = {
    color: isDragOver ? THEME.accent : THEME.textMuted,
    transition: 'color 150ms ease',
  };

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: THEME.textPrimary,
  };

  const hintStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.8125rem',
    color: THEME.textMuted,
    lineHeight: 1.5,
  };

  const fileInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.625rem 0.875rem',
    backgroundColor: `${THEME.accent}18`,
    border: `1px solid ${THEME.accent}55`,
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: THEME.textPrimary,
    marginTop: '0.75rem',
    width: '100%',
    boxSizing: 'border-box',
  };

  const errorBoxStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#B91C1C18',
    border: '1px solid #B91C1C66',
    borderRadius: '0.375rem',
    marginTop: '0.75rem',
  };

  const errorTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#FCA5A5',
  };

  const errorDetailStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#FCA5A5CC',
    lineHeight: 1.5,
  };

  const errorActionStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.8125rem',
    color: THEME.textMuted,
    lineHeight: 1.5,
    fontStyle: 'italic',
  };

  const infoBoxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    backgroundColor: '#B4530918',
    border: '1px solid #B4530966',
    borderRadius: '0.375rem',
    fontSize: '0.8125rem',
    color: '#FCD34D',
    marginTop: '0.75rem',
    lineHeight: 1.5,
  };

  // Effective file name/size to display
  const displayName = fileMetadata?.name ?? localFile?.name;
  const displaySize = fileMetadata?.formattedSize ?? localFile?.size;
  const hasFileInfo = Boolean(displayName);

  // Determine if processing is happening (shows spinner + progress)
  const isProcessing =
    isLoading ||
    status === 'validating' ||
    status === 'parsing' ||
    status === 'normalizing' ||
    status === 'detecting';

  return (
    <div style={{ width: '100%' }}>
      {/* Zona de drag-and-drop */}
      <div
        style={dropZoneStyle}
        onDragOver={isLoading ? undefined : handleDragOver}
        onDragLeave={isLoading ? undefined : handleDragLeave}
        onDrop={isLoading ? undefined : handleDrop}
        aria-label="Zona de arrastrar y soltar archivos. Arrastre un archivo .xlsx, .xls o .csv aquí o use el botón para seleccionarlo."
        aria-disabled={isLoading}
        role="region"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleSelectClick();
          }
        }}
      >
        {/* Icono de carga */}
        <div style={iconStyle} aria-hidden="true">
          {isProcessing ? (
            <Spinner size="lg" aria-hidden="true" />
          ) : (
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>

        {/* Texto principal */}
        {!isProcessing && (
          <>
            <h2 style={headingStyle}>
              Arrastre su archivo aquí
            </h2>
            <p style={hintStyle}>
              Formatos aceptados: .xlsx, .xls, .csv · Tamaño máximo: 50 MB
            </p>
          </>
        )}

        {isProcessing && (
          <p style={{ margin: 0, fontSize: '0.9375rem', color: THEME.textMuted }}>
            Procesando archivo…
          </p>
        )}

        {/* Botón de selección */}
        {!isProcessing && (
          <Button
            variant="primary"
            size="md"
            onClick={handleSelectClick}
            disabled={isLoading}
            aria-label="Abrir selector de archivo"
          >
            Seleccionar archivo
          </Button>
        )}

        {/* Input oculto */}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Información del archivo seleccionado */}
      {hasFileInfo && !displayError && (
        <div style={fileInfoStyle} aria-live="polite">
          {/* Icono de archivo */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={THEME.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>
            <strong style={{ color: THEME.textPrimary }}>{displayName}</strong>
            {displaySize && (
              <span style={{ color: THEME.textMuted }}> · {displaySize}</span>
            )}
          </span>
        </div>
      )}

      {/* Barra de progreso */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Cargando archivo. Progreso: ${Math.round(progress)}%`}
          style={{ marginTop: '0.5rem' }}
        >
          <ProgressBar progress={progress} />
          <ProgressLabel progress={progress} status={status} />
        </div>
      )}

      {/* Mensaje informativo (ej. múltiples hojas) */}
      {infoMessage && !displayError && (
        <div style={infoBoxStyle} role="note" aria-live="polite">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: '0.125rem' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Mensajes de error */}
      {displayError && (
        <div
          style={errorBoxStyle}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <p style={errorTitleStyle}>
            {/* Icono de error */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '0.375rem', verticalAlign: 'text-bottom' }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {displayError.message}
          </p>
          <p style={errorDetailStyle}>{displayError.cause}</p>
          <p style={errorActionStyle}>{displayError.suggestedAction}</p>
        </div>
      )}

      {/* Vista previa de datos */}
      {previewData && previewData.headers.length > 0 && (
        <PreviewTable headers={previewData.headers} rows={previewData.rows} />
      )}
    </div>
  );
};

export default FileUploader;
