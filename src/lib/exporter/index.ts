/**
 * Exportador CSV / Excel — SOC Incident Analyzer
 *
 * Funciones de exportación de incidentes:
 *   - `exportToCSV`    → string CSV con encabezados y filas escapadas
 *   - `exportToExcel`  → ArrayBuffer de un archivo .xlsx (SheetJS)
 *   - `downloadFile`   → descarga un Blob en el navegador
 */

import * as XLSX from 'xlsx';
import type { Incident } from '../../types';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

/** Fila de datos de un incidente, lista para serializar */
interface IncidentRow {
  id: string;
  riskLevel: string;
  reason: string;
  firstTimestamp: string;
  evidenceCount: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Encabezados de columna en el orden canónico */
const HEADERS: (keyof IncidentRow)[] = [
  'id',
  'riskLevel',
  'reason',
  'firstTimestamp',
  'evidenceCount',
];

/** Etiquetas legibles para los encabezados (mismo orden que HEADERS) */
const HEADER_LABELS: string[] = [
  'ID',
  'Nivel de Riesgo',
  'Motivo',
  'Primer Timestamp',
  'Registros de Evidencia',
];

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Construye el array de filas a partir de la lista de incidentes.
 * `firstTimestamp` se emite como su valor ISO 8601 o "N/A" si es null.
 */
function buildRows(incidents: Incident[]): IncidentRow[] {
  return incidents.map((incident) => ({
    id: incident.id,
    riskLevel: incident.riskLevel,
    reason: incident.reason,
    firstTimestamp: incident.firstTimestamp ?? 'N/A',
    evidenceCount: incident.evidenceRecords.length,
  }));
}

/**
 * Escapa un valor individual para el formato CSV.
 *
 * Reglas de escape:
 * - Convertir a string
 * - Si contiene comas, comillas dobles o saltos de línea → envolver entre comillas dobles
 * - Cada comilla doble interna se duplica ("")
 */
function escapeCSVField(value: string | number): string {
  const str = String(value);
  // Necesita comillas si contiene coma, comillas dobles o salto de línea
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// 1. exportToCSV
// ---------------------------------------------------------------------------

/**
 * Serializa una lista de incidentes a una cadena CSV.
 *
 * - Primera fila: encabezados de columna.
 * - Una fila por incidente con los campos: id, riskLevel, reason,
 *   firstTimestamp (ISO 8601 o "N/A"), evidenceCount.
 * - Los campos con comas o comillas se envuelven entre comillas dobles.
 * - Si `incidents` está vacío devuelve solo la fila de encabezados.
 */
export function exportToCSV(incidents: Incident[]): string {
  const lines: string[] = [];

  // Fila de encabezados
  lines.push(HEADER_LABELS.map(escapeCSVField).join(','));

  // Filas de datos
  const rows = buildRows(incidents);
  for (const row of rows) {
    const cells = HEADERS.map((key) => escapeCSVField(row[key]));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 2. exportToExcel
// ---------------------------------------------------------------------------

/**
 * Genera un archivo .xlsx con la lista de incidentes usando SheetJS.
 *
 * - Mismos campos que el CSV.
 * - Encabezados en la primera fila.
 * - Ancho de columnas auto-ajustado (wch) calculado como el máximo
 *   de la longitud del encabezado y el contenido de cada celda.
 * - Devuelve un `ArrayBuffer` listo para su descarga.
 */
export function exportToExcel(incidents: Incident[]): ArrayBuffer {
  const rows = buildRows(incidents);

  // Construir array de objetos con etiquetas legibles para SheetJS
  const sheetData: Record<string, string | number>[] = rows.map((row) => ({
    [HEADER_LABELS[0]]: row.id,
    [HEADER_LABELS[1]]: row.riskLevel,
    [HEADER_LABELS[2]]: row.reason,
    [HEADER_LABELS[3]]: row.firstTimestamp,
    [HEADER_LABELS[4]]: row.evidenceCount,
  }));

  // Crear la hoja; si no hay datos SheetJS crea una hoja vacía con encabezados
  const worksheet =
    sheetData.length > 0
      ? XLSX.utils.json_to_sheet(sheetData)
      : XLSX.utils.aoa_to_sheet([HEADER_LABELS]);

  // Auto-ajustar anchos de columna (wch = max caracteres)
  const columnWidths: number[] = HEADER_LABELS.map((label) => label.length);

  for (const row of sheetData) {
    HEADER_LABELS.forEach((label, colIndex) => {
      const cellValue = String(row[label] ?? '');
      if (cellValue.length > columnWidths[colIndex]) {
        columnWidths[colIndex] = cellValue.length;
      }
    });
  }

  worksheet['!cols'] = columnWidths.map((wch) => ({ wch: wch + 2 })); // +2 de padding

  // Crear workbook y serializar a ArrayBuffer
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Incidentes');

  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array', // devuelve Uint8Array internamente
  }) as Uint8Array;

  // Devolver ArrayBuffer real
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

// ---------------------------------------------------------------------------
// 3. downloadFile
// ---------------------------------------------------------------------------

/**
 * Descarga un archivo en el navegador usando la API Blob + URL.createObjectURL.
 *
 * @param content  Contenido del archivo como `string` (CSV) o `ArrayBuffer` (Excel).
 * @param filename Nombre de archivo sugerido al navegador.
 * @param mimeType MIME type del archivo (ej. "text/csv" o
 *                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").
 */
export function downloadFile(
  content: string | ArrayBuffer,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  // Insertar brevemente en el DOM para compatibilidad con Firefox
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Liberar la URL de objeto para evitar fugas de memoria
  URL.revokeObjectURL(url);
}
