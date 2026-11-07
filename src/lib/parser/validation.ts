/**
 * Utilidades de validación de archivos y formateo de tamaño.
 *
 * Módulo puro (sin efectos secundarios ni dependencias externas) que valida
 * archivos antes de enviarlos al Web Worker de procesamiento.
 *
 * Funciones exportadas:
 *   - `validateExtension` — verifica que la extensión sea .xlsx, .xls o .csv
 *   - `validateSize`      — verifica que el tamaño no supere 50 MB
 *   - `formatFileSize`    — formatea bytes a "X.XX KB" o "X.XX MB"
 */

import type { AppError } from '../../types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Extensiones de archivo aceptadas (en minúsculas) */
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** Límite máximo de tamaño: 50 MB en bytes */
const MAX_SIZE_BYTES = 52_428_800; // 50 × 1 024 × 1 024

/** 1 MB en bytes */
const ONE_MB = 1_048_576; // 1 024 × 1 024

/** 1 KB en bytes */
const ONE_KB = 1_024;

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

/**
 * Convierte un tamaño en bytes a una cadena legible con exactamente 2 decimales.
 *
 * - Si `bytes` es menor a 1 MB (< 1 048 576): devuelve `"X.XX KB"`
 * - Si `bytes` es mayor o igual a 1 MB (≥ 1 048 576): devuelve `"X.XX MB"`
 *
 * @param bytes — Tamaño en bytes (entero no negativo)
 * @returns Cadena formateada, ej. `"456.78 KB"` o `"1.23 MB"`
 */
export function formatFileSize(bytes: number): string {
  if (bytes < ONE_MB) {
    const kb = bytes / ONE_KB;
    return `${kb.toFixed(2)} KB`;
  }
  const mb = bytes / ONE_MB;
  return `${mb.toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// validateExtension
// ---------------------------------------------------------------------------

/**
 * Verifica que el nombre de archivo termine con una extensión permitida
 * (`.xlsx`, `.xls` o `.csv`). La comparación es case-insensitive.
 *
 * @param filename — Nombre completo del archivo, incluyendo extensión
 * @returns `{ valid: true }` si la extensión es aceptada;
 *          `{ valid: false, error: AppError }` en caso contrario
 */
export function validateExtension(
  filename: string,
): { valid: true; extension: AllowedExtension } | { valid: false; error: AppError } {
  const lower = filename.toLowerCase();
  const matched = ALLOWED_EXTENSIONS.find(ext => lower.endsWith(ext));

  if (matched) {
    return { valid: true, extension: matched };
  }

  // Extraer la extensión que el usuario intentó subir para incluirla en el mensaje
  const dotIndex = filename.lastIndexOf('.');
  const attemptedExt = dotIndex !== -1 ? filename.slice(dotIndex) : '(sin extensión)';

  return {
    valid: false,
    error: {
      code: 'UNSUPPORTED_FORMAT',
      message: `El archivo "${filename}" tiene una extensión no compatible (${attemptedExt}).`,
      cause: `Solo se aceptan archivos con extensión .xlsx, .xls o .csv. Se recibió: ${attemptedExt}`,
      suggestedAction:
        'Seleccione un archivo en formato Excel (.xlsx o .xls) o en formato CSV (.csv) e inténtelo de nuevo.',
    },
  };
}

// ---------------------------------------------------------------------------
// validateSize
// ---------------------------------------------------------------------------

/**
 * Verifica que el tamaño del archivo no supere el límite de 50 MB
 * (52 428 800 bytes exactos).
 *
 * @param sizeBytes — Tamaño del archivo en bytes
 * @returns `{ valid: true }` si el tamaño es aceptable;
 *          `{ valid: false, error: AppError }` si supera el límite
 */
export function validateSize(
  sizeBytes: number,
): { valid: true } | { valid: false; error: AppError } {
  if (sizeBytes <= MAX_SIZE_BYTES) {
    return { valid: true };
  }

  const actualFormatted = formatFileSize(sizeBytes);

  return {
    valid: false,
    error: {
      code: 'FILE_TOO_LARGE',
      message: `El archivo seleccionado (${actualFormatted}) supera el límite máximo permitido de 50 MB.`,
      cause: `El archivo tiene ${actualFormatted} (${sizeBytes.toLocaleString('es-ES')} bytes), que excede el límite de 52 428 800 bytes (50 MB).`,
      suggestedAction:
        'Seleccione un archivo de menor tamaño o divida el archivo en partes de máximo 50 MB e inténtelo de nuevo.',
    },
  };
}
