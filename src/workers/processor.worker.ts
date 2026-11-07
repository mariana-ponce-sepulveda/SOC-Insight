/**
 * processor.worker.ts — Web Worker de procesamiento SOC Incident Analyzer
 *
 * Ejecuta el pipeline completo fuera del hilo principal:
 *   parseFile → normalizeRecords → detectIncidents
 *
 * Protocolo de mensajes entrantes (postMessage desde el hilo principal):
 *   { file: ArrayBuffer, fileExtension: string, config: RuleConfig }
 *
 * Mensajes salientes (postMessage al hilo principal):
 *   { type: 'progress', progress: number, stage: string }
 *   { type: 'result', records, incidents, skippedRules, processingErrors, fileMetadata }
 *   { type: 'error', error: AppError }
 */

import { parseFile } from '../lib/parser/index';
import { normalizeRecords } from '../lib/normalizer/index';
import { detectIncidents } from '../lib/ruleEngine/index';
import { formatFileSize } from '../lib/parser/validation';

import type {
  RuleConfig,
  AppError,
  NormalizedRecord,
  ProcessingError,
  FileMetadata,
} from '../types';

// ---------------------------------------------------------------------------
// Tipos de mensajes del protocolo Worker
// ---------------------------------------------------------------------------

/** Mensaje que el hilo principal envía al Worker para iniciar el pipeline */
interface WorkerInput {
  file: ArrayBuffer;
  fileExtension: string;
  config: RuleConfig;
  /** Nombre original del archivo (para FileMetadata) */
  fileName: string;
  /** Tamaño en bytes del archivo (para FileMetadata) */
  fileSizeBytes: number;
}

/** Mensaje de progreso emitido mientras el Worker trabaja */
interface ProgressMessage {
  type: 'progress';
  /** Porcentaje de progreso (0–100) */
  progress: number;
  /** Descripción legible de la etapa actual */
  stage: string;
}

/** Mensaje de resultado final emitido al completar el pipeline */
interface ResultMessage {
  type: 'result';
  records: NormalizedRecord[];
  incidents: ReturnType<typeof detectIncidents>['incidents'];
  skippedRules: ReturnType<typeof detectIncidents>['skippedRules'];
  processingErrors: ProcessingError[];
  fileMetadata: FileMetadata;
}

/** Mensaje de error irrecuperable emitido cuando el pipeline falla */
interface ErrorMessage {
  type: 'error';
  error: AppError;
}

type WorkerOutMessage = ProgressMessage | ResultMessage | ErrorMessage;

// ---------------------------------------------------------------------------
// Helpers de emisión de mensajes
// ---------------------------------------------------------------------------

function emitProgress(progress: number, stage: string): void {
  const msg: ProgressMessage = { type: 'progress', progress: Math.round(progress), stage };
  self.postMessage(msg);
}

function emitResult(payload: Omit<ResultMessage, 'type'>): void {
  const msg: ResultMessage = { type: 'result', ...payload };
  self.postMessage(msg);
}

function emitError(error: AppError): void {
  const msg: ErrorMessage = { type: 'error', error };
  self.postMessage(msg);
}

// ---------------------------------------------------------------------------
// Construcción de AppError genérico para fallos inesperados
// ---------------------------------------------------------------------------

function makeUnknownError(cause: unknown): AppError {
  const causeStr = cause instanceof Error ? cause.message : String(cause);
  return {
    code: 'WORKER_ERROR',
    message: 'Se produjo un error inesperado durante el procesamiento del archivo.',
    cause: causeStr,
    suggestedAction:
      'Recargue la página e intente cargar el archivo nuevamente. Si el problema persiste, compruebe que el archivo no está dañado.',
  };
}

// ---------------------------------------------------------------------------
// Normalización por lotes con progreso
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1_000;

/**
 * Ejecuta `normalizeRecords` en lotes de `BATCH_SIZE` filas, emitiendo mensajes
 * de progreso después de cada lote para que la UI pueda actualizarse.
 *
 * El rango de progreso asignado a esta etapa es 10 %–70 %.
 *
 * @returns Tuple [registros normalizados, errores de procesamiento de filas]
 */
async function normalizeInBatches(
  headers: string[],
  rows: Record<string, unknown>[],
): Promise<[NormalizedRecord[], ProcessingError[]]> {
  const totalRows = rows.length;
  const allRecords: NormalizedRecord[] = [];
  const processingErrors: ProcessingError[] = [];

  if (totalRows === 0) {
    emitProgress(70, 'Normalización completada');
    return [allRecords, processingErrors];
  }

  let processedRows = 0;

  for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
    const batchRows = rows.slice(batchStart, batchEnd);

    // Procesar el lote fila a fila para capturar errores individuales
    for (let i = 0; i < batchRows.length; i++) {
      const absoluteRowIndex = batchStart + i;
      try {
        // normalizeRecords espera el array completo de headers y un subconjunto de filas
        const [normalized] = normalizeRecords(headers, [batchRows[i]]);
        if (normalized !== undefined) {
          // Corregir el _rowIndex al índice absoluto en el archivo original
          allRecords.push({ ...normalized, _rowIndex: absoluteRowIndex });
        } else {
          // La función devolvió un array vacío para esta fila → fila omitida
          processingErrors.push({
            rowIndex: absoluteRowIndex + 1, // 1-based para mensajes de usuario
            message: `La fila ${absoluteRowIndex + 1} fue omitida durante la normalización.`,
            cause: 'La fila no produjo un registro válido.',
          });
        }
      } catch (err) {
        // Error inesperado en esta fila → registrar y continuar
        processingErrors.push({
          rowIndex: absoluteRowIndex + 1,
          message: `Error al procesar la fila ${absoluteRowIndex + 1}.`,
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }

    processedRows += batchRows.length;

    // Emitir progreso: escala 10 % → 70 % según el avance de la normalización
    const normalizationFraction = processedRows / totalRows;
    const overallProgress = 10 + normalizationFraction * 60;
    emitProgress(overallProgress, `Normalizando registros (${processedRows}/${totalRows})`);

    // Ceder el control al event loop para no bloquear mensajes de salida
    // (en un Worker esto es necesario para que los postMessage fluyan)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return [allRecords, processingErrors];
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------

async function runPipeline(input: WorkerInput): Promise<void> {
  const { file, fileExtension, config, fileName, fileSizeBytes } = input;
  const processingErrors: ProcessingError[] = [];

  // ── Etapa 1: Parsing (0 % → 10 %) ────────────────────────────────────────
  emitProgress(0, 'Iniciando análisis del archivo…');

  let parseResult: Awaited<ReturnType<typeof parseFile>>;
  try {
    parseResult = await parseFile(file, fileExtension);
  } catch (err) {
    // parseFile lanza AppError para archivos corruptos / extensión inválida
    if (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      'message' in err &&
      'cause' in err &&
      'suggestedAction' in err
    ) {
      emitError(err as AppError);
    } else {
      emitError(makeUnknownError(err));
    }
    return;
  }

  emitProgress(10, 'Archivo leído correctamente. Normalizando registros…');

  // Si el archivo tiene múltiples hojas, adjuntar aviso informativo (no es error)
  if (parseResult.multipleSheets) {
    processingErrors.push({
      message:
        `El archivo contiene múltiples hojas. Solo se procesará la primera hoja: "${parseResult.sheetName}".`,
      cause: 'Archivo con múltiples hojas de cálculo.',
    });
  }

  const { headers, rows, sheetName, multipleSheets } = parseResult;

  // ── Etapa 2: Normalización (10 % → 70 %) ─────────────────────────────────
  const [records, normErrors] = await normalizeInBatches(headers, rows);

  // Agregar errores de filas ilegibles a la lista acumulada
  processingErrors.push(...normErrors);

  emitProgress(70, 'Normalización completada. Detectando incidentes…');

  // ── Etapa 3: Detección de incidentes (70 % → 100 %) ──────────────────────
  let detectionResult: ReturnType<typeof detectIncidents>;
  try {
    detectionResult = detectIncidents(records, config);
  } catch (err) {
    emitError({
      code: 'DETECTION_ERROR',
      message: 'Se produjo un error durante la detección de incidentes.',
      cause: err instanceof Error ? err.message : String(err),
      suggestedAction:
        'Recargue la página e intente cargar el archivo nuevamente. Si el problema persiste, compruebe la integridad del archivo.',
    });
    return;
  }

  emitProgress(100, 'Análisis completado.');

  // ── Construir FileMetadata ─────────────────────────────────────────────────
  const ext = fileExtension.toLowerCase().trim() as '.xlsx' | '.xls' | '.csv';
  const fileMetadata: FileMetadata = {
    name: fileName,
    sizeBytes: fileSizeBytes,
    formattedSize: formatFileSize(fileSizeBytes),
    extension: ext,
    sheetName: ext !== '.csv' ? sheetName : undefined,
    multipleSheets,
  };

  // ── Emitir resultado final ─────────────────────────────────────────────────
  emitResult({
    records,
    incidents: detectionResult.incidents,
    skippedRules: detectionResult.skippedRules,
    processingErrors,
    fileMetadata,
  });
}

// ---------------------------------------------------------------------------
// Escucha de mensajes entrantes
// ---------------------------------------------------------------------------

self.addEventListener('message', (event: MessageEvent<WorkerInput>) => {
  runPipeline(event.data).catch((err) => {
    emitError(makeUnknownError(err));
  });
});

// Necesario para satisfacer el compilador TypeScript en módulos de Worker
export type { WorkerInput, WorkerOutMessage, ProgressMessage, ResultMessage, ErrorMessage };
