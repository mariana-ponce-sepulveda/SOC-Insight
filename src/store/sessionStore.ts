/**
 * Zustand store — SOC Incident Analyzer
 *
 * Gestiona el estado global de la sesión de análisis:
 *   - Estado inicial 'idle' con todos los campos vacíos
 *   - `loadFile`      → valida, instancia el Worker, gestiona mensajes de progreso y resultado
 *   - `clearSession`  → resetea todo al estado inicial
 *   - `setFilters`    → merge parcial de filtros activos
 *   - `resetFilters`  → vuelve a los filtros vacíos
 *
 * Selectores derivados (sin suscripción adicional al store):
 *   - `filteredIncidents()` → aplica filtros activos sobre `incidents`
 *   - `incidentsByRiskLevel()` → delega a `calcIncidentsByRiskLevel`
 */

import { create } from 'zustand';

import type {
  ActiveFilters,
  ActiveSession,
  AppError,
  Incident,
  NormalizedRecord,
  ProcessingError,
  RiskLevel,
  SessionStore,
} from '../types';

import { validateExtension, validateSize } from '../lib/parser/validation';
import { calcIncidentsByRiskLevel } from '../lib/stats';
import { DEFAULT_RULE_CONFIG } from '../constants/rules';

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

const INITIAL_FILTERS: ActiveFilters = {
  riskLevels: [],
  dateRange: { from: null, to: null },
  sourceIP: '',
};

const INITIAL_STATE: ActiveSession & { error: AppError | null } = {
  status: 'idle',
  progress: 0,
  file: null,
  totalRecords: 0,
  records: [],
  incidents: [],
  processingErrors: [],
  filters: INITIAL_FILTERS,
  analysisTimestamp: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Tipos de mensajes del Worker
// ---------------------------------------------------------------------------

interface WorkerProgressMessage {
  type: 'progress';
  progress: number;
}

interface WorkerResultMessage {
  type: 'result';
  records: NormalizedRecord[];
  incidents: Incident[];
  processingErrors: ProcessingError[];
  fileMetadata: {
    name: string;
    sizeBytes: number;
    formattedSize: string;
    extension: '.xlsx' | '.xls' | '.csv';
    sheetName?: string;
    multipleSheets: boolean;
  };
}

interface WorkerErrorMessage {
  type: 'error';
  error: AppError;
}

type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionStore & { error: AppError | null }>((set, get) => ({
  ...INITIAL_STATE,

  // -------------------------------------------------------------------------
  // loadFile
  // -------------------------------------------------------------------------
  async loadFile(file: File): Promise<void> {
    // 1. Validar extensión
    const extResult = validateExtension(file.name);
    if (!extResult.valid) {
      set({ status: 'error', error: extResult.error });
      return;
    }

    // 2. Validar tamaño
    const sizeResult = validateSize(file.size);
    if (!sizeResult.valid) {
      set({ status: 'error', error: sizeResult.error });
      return;
    }

    // 3. Estado 'validating' → limpiar sesión anterior
    set({
      ...INITIAL_STATE,
      status: 'validating',
      progress: 0,
    });

    // 4. Leer el archivo como ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      set({
        status: 'error',
        error: {
          code: 'FILE_CORRUPTED',
          message: `El archivo "${file.name}" no pudo ser leído.`,
          cause: 'No se pudo obtener el contenido del archivo como buffer.',
          suggestedAction:
            'Verifique que el archivo no esté dañado y vuelva a intentarlo.',
        },
      });
      return;
    }

    // 5. Instanciar el Worker
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../workers/processor.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch {
      set({
        status: 'error',
        error: {
          code: 'WORKER_ERROR',
          message: 'No se pudo iniciar el procesamiento del archivo.',
          cause: 'Error al instanciar el Web Worker de procesamiento.',
          suggestedAction:
            'Recargue la página e intente de nuevo. Si el problema persiste, verifique que su navegador soporte Web Workers.',
        },
      });
      return;
    }

    // 6. Estado 'parsing'
    set({ status: 'parsing', progress: 0 });

    // 7. Escuchar mensajes del Worker
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'progress': {
          // Mapear 'parsing' durante el parseo y 'normalizing'/'detecting' según progreso
          const currentStatus = get().status;
          let nextStatus: ActiveSession['status'] = currentStatus;

          if (msg.progress < 40) {
            nextStatus = 'parsing';
          } else if (msg.progress < 80) {
            nextStatus = 'normalizing';
          } else {
            nextStatus = 'detecting';
          }

          set({ progress: msg.progress, status: nextStatus });
          break;
        }

        case 'result': {
          const { records, incidents, processingErrors, fileMetadata } = msg;

          set({
            status: 'ready',
            progress: 100,
            file: fileMetadata,
            totalRecords: records.length,
            records,
            incidents,
            processingErrors: processingErrors,
            analysisTimestamp: new Date().toISOString(),
            error: null,
          });

          worker.terminate();
          break;
        }

        case 'error': {
          set({
            status: 'error',
            error: msg.error,
          });

          worker.terminate();
          break;
        }
      }
    };

    // 8. Escuchar errores inesperados del Worker
    worker.onerror = (event: ErrorEvent) => {
      set({
        status: 'error',
        error: {
          code: 'WORKER_ERROR',
          message: 'Ocurrió un error inesperado durante el procesamiento.',
          cause: event.message ?? 'Error desconocido en el Web Worker.',
          suggestedAction:
            'Intente cargar el archivo nuevamente. Si el error persiste, verifique que el archivo no esté corrupto.',
        },
      });

      worker.terminate();
    };

    // 9. Enviar el trabajo al Worker (ArrayBuffer como Transferable)
    worker.postMessage(
      {
        file: arrayBuffer,
        fileExtension: extResult.extension,
        config: DEFAULT_RULE_CONFIG,
        fileName: file.name,
        fileSizeBytes: file.size,
      },
      [arrayBuffer],
    );
  },

  // -------------------------------------------------------------------------
  // clearSession
  // -------------------------------------------------------------------------
  clearSession(): void {
    set({ ...INITIAL_STATE });
  },

  // -------------------------------------------------------------------------
  // setFilters
  // -------------------------------------------------------------------------
  setFilters(filters: Partial<ActiveFilters>): void {
    set((state) => ({
      filters: {
        ...state.filters,
        ...filters,
        // Merge anidado del dateRange si se pasa parcialmente
        dateRange:
          filters.dateRange !== undefined
            ? { ...state.filters.dateRange, ...filters.dateRange }
            : state.filters.dateRange,
      },
    }));
  },

  // -------------------------------------------------------------------------
  // resetFilters
  // -------------------------------------------------------------------------
  resetFilters(): void {
    set({ filters: { ...INITIAL_FILTERS, dateRange: { from: null, to: null } } });
  },

  // -------------------------------------------------------------------------
  // filteredIncidents (selector derivado)
  // -------------------------------------------------------------------------
  filteredIncidents(): Incident[] {
    const { incidents, filters } = get();
    let result = incidents;

    // Filtro por nivel de riesgo
    if (filters.riskLevels.length > 0) {
      result = result.filter((inc) =>
        filters.riskLevels.includes(inc.riskLevel as RiskLevel),
      );
    }

    // Filtro por IP de origen
    if (filters.sourceIP.trim() !== '') {
      const ipQuery = filters.sourceIP.trim().toLowerCase();
      result = result.filter((inc) =>
        inc.evidenceRecords.some((rec) => {
          const ipField = rec.fields['sourceIP'];
          if (!ipField || ipField.status === 'absent') return false;
          return String(ipField.normalized ?? ipField.raw)
            .toLowerCase()
            .includes(ipQuery);
        }),
      );
    }

    // Filtro por rango de fecha
    const { from, to } = filters.dateRange;
    if (from !== null || to !== null) {
      const fromMs = from !== null ? new Date(from).getTime() : -Infinity;
      const toMs   = to   !== null ? new Date(to).getTime()   :  Infinity;

      result = result.filter((inc) => {
        // Usar firstTimestamp del incidente si está disponible
        const ts = inc.firstTimestamp;
        if (ts === null) return true; // Incluir incidentes sin timestamp
        const incMs = new Date(ts).getTime();
        if (isNaN(incMs)) return true;
        return incMs >= fromMs && incMs <= toMs;
      });
    }

    return result;
  },

  // -------------------------------------------------------------------------
  // incidentsByRiskLevel (selector derivado)
  // -------------------------------------------------------------------------
  incidentsByRiskLevel(): Record<RiskLevel, number> {
    return calcIncidentsByRiskLevel(get().incidents);
  },
}));
