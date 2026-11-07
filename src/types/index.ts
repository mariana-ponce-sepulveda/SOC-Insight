/**
 * Tipos compartidos — SOC Incident Analyzer
 *
 * Todos los tipos TypeScript del dominio, definidos según el documento
 * de diseño técnico. Este archivo es la única fuente de verdad para
 * los contratos entre capas (parser → normalizer → ruleEngine → store → UI).
 */

// ---------------------------------------------------------------------------
// Capa de parser (SheetJS)
// ---------------------------------------------------------------------------

/** Fila cruda leída por SheetJS antes de cualquier procesamiento */
export type RawRow = Record<string, unknown>;

/** Resultado devuelto por el parser al procesar un archivo */
export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  sheetName: string;
  /** true cuando el archivo contiene más de una hoja; solo se procesa la primera */
  multipleSheets: boolean;
}

// ---------------------------------------------------------------------------
// Capa de normalización
// ---------------------------------------------------------------------------

/** Campos reconocidos en el esquema estándar */
export type RecognizedField =
  | 'timestamp'
  | 'sourceIP'
  | 'destinationIP'
  | 'user'
  | 'eventType'
  | 'sourceSystem'
  | 'description'
  | 'status'
  | 'severity';

/** Valor normalizado de un campo reconocido */
export interface NormalizedFieldValue {
  /** Valor original tal como viene del archivo */
  raw: unknown;
  /** Valor normalizado (fecha ISO 8601, string, etc.) */
  normalized: unknown;
  /** Estado de la normalización */
  status: 'ok' | 'absent' | 'unparseable';
}

/** Advertencia de normalización adjunta a un registro */
export interface ParseWarning {
  field: RecognizedField;
  /** Descripción del problema, ej. "Fecha no normalizable: valor conservado como texto" */
  message: string;
}

/** Registro normalizado — resultado de la capa de normalización */
export interface NormalizedRecord {
  /** Índice de fila original en el archivo fuente */
  _rowIndex: number;
  /** Campos del esquema estándar con su valor normalizado */
  fields: Partial<Record<RecognizedField, NormalizedFieldValue>>;
  /** Columnas no reconocidas, preservadas sin modificar */
  extra: Record<string, unknown>;
  /** Advertencias generadas durante la normalización de este registro */
  parseWarnings: ParseWarning[];
}

// ---------------------------------------------------------------------------
// Motor de detección de incidentes
// ---------------------------------------------------------------------------

/** Niveles de riesgo en orden descendente de severidad */
export type RiskLevel =
  | 'CRÍTICO'
  | 'ALTO'
  | 'MEDIO'
  | 'BAJO'
  | 'INFORMATIVO';

/** Regla de detección que se disparó para un incidente */
export interface TriggeredRule {
  ruleId: string;
  ruleName: string;
  severity: RiskLevel;
  /** Información adicional, ej. "IP 192.168.1.1 disparó fuerza bruta" */
  details?: string;
}

/** Incidente detectado por el motor de reglas */
export interface Incident {
  /** UUID generado en el momento de la detección */
  id: string;
  /** Nivel de la regla de mayor severidad entre todas las disparadas */
  riskLevel: RiskLevel;
  /** Texto legible: nombre(s) de regla(s) + nivel de riesgo */
  reason: string;
  /** Lista de reglas que se dispararon para este incidente */
  triggeredRules: TriggeredRule[];
  /** Registros de respaldo con todos los campos originales preservados */
  evidenceRecords: NormalizedRecord[];
  /** Timestamp del primer registro de evidencia en formato ISO 8601, o null si no disponible */
  firstTimestamp: string | null;
  /** Timestamp del último registro de evidencia en formato ISO 8601, o null si no disponible */
  lastTimestamp: string | null;
}

/** Regla omitida porque uno o más campos requeridos estaban ausentes */
export interface SkippedRule {
  ruleId: string;
  ruleName: string;
  /** Campos que estaban ausentes y causaron la omisión */
  missingFields: RecognizedField[];
}

/** Resultado devuelto por el motor de detección */
export interface DetectionResult {
  incidents: Incident[];
  skippedRules: SkippedRule[];
}

// ---------------------------------------------------------------------------
// Configuración del motor de reglas
// ---------------------------------------------------------------------------

/** Configuración en tiempo de ejecución para el motor de detección */
export interface RuleConfig {
  workingHours: {
    /** Hora de inicio del horario laboral (0–23), por defecto 8 */
    start: number;
    /** Hora de fin del horario laboral (0–23), por defecto 18 */
    end: number;
    /** Días laborables: 1 = Lunes … 7 = Domingo; por defecto [1,2,3,4,5] */
    daysOfWeek: number[];
  };
  bruteForce: {
    /** Número mínimo de intentos fallidos para disparar la regla; por defecto 5 */
    threshold: number;
    /** Duración de la ventana deslizante en minutos; por defecto 10 */
    windowMinutes: number;
  };
}

/** Contexto pasado a cada regla durante la evaluación */
export interface DetectionContext {
  /** Configuración activa del motor */
  config: RuleConfig;
  /** Todos los registros del lote (necesarios para reglas multi-registro como BRUTE_FORCE) */
  allRecords: NormalizedRecord[];
}

/** Definición de una regla de detección */
export interface DetectionRule {
  id: string;
  name: string;
  severity: RiskLevel;
  /** Campos que deben estar presentes (status !== 'absent') para que la regla se evalúe */
  requiredFields: RecognizedField[];
  /**
   * Función de evaluación pura.
   * Recibe el registro individual y el contexto completo del lote.
   * Devuelve true si la regla se dispara para este registro.
   */
  evaluate: (record: NormalizedRecord, context: DetectionContext) => boolean;
}

// ---------------------------------------------------------------------------
// Estado de sesión
// ---------------------------------------------------------------------------

/** Estados posibles del ciclo de vida de una sesión */
export type SessionStatus =
  | 'idle'          // Sin sesión activa
  | 'validating'    // Validando archivo (extensión, tamaño)
  | 'parsing'       // Web Worker parseando el archivo
  | 'normalizing'   // Normalizando registros
  | 'detecting'     // Detectando incidentes
  | 'ready'         // Análisis completado con éxito
  | 'error';        // Error irrecuperable

/** Metadatos del archivo cargado */
export interface FileMetadata {
  name: string;
  sizeBytes: number;
  /** Tamaño formateado con 2 decimales, ej. "1.23 MB" o "456.78 KB" */
  formattedSize: string;
  extension: '.xlsx' | '.xls' | '.csv';
  /** Nombre de la hoja procesada (solo para .xlsx/.xls) */
  sheetName?: string;
  /** true si el archivo tenía más de una hoja */
  multipleSheets: boolean;
}

/** Error de procesamiento de una fila individual */
export interface ProcessingError {
  /** Índice de la fila que falló (1-based para mensajes de usuario) */
  rowIndex?: number;
  message: string;
  /** Causa técnica del error */
  cause?: string;
}

/** Filtros activos en el dashboard */
export interface ActiveFilters {
  /** Array vacío = sin filtro por nivel */
  riskLevels: RiskLevel[];
  dateRange: {
    from: string | null;
    to: string | null;
  };
  /** String vacío = sin filtro por IP */
  sourceIP: string;
}

/** Estado completo de una sesión de análisis */
export interface ActiveSession {
  status: SessionStatus;
  /** Progreso del procesamiento en el Worker (0–100) */
  progress: number;
  file: FileMetadata | null;
  totalRecords: number;
  records: NormalizedRecord[];
  incidents: Incident[];
  processingErrors: ProcessingError[];
  filters: ActiveFilters;
  /** ISO 8601: momento en que finalizó el análisis */
  analysisTimestamp: string | null;
}

// ---------------------------------------------------------------------------
// Gestión de errores (AppError)
// ---------------------------------------------------------------------------

/** Códigos de error conocidos por la aplicación */
export type AppErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'FILE_CORRUPTED'
  | 'PARSE_ERROR'
  | 'NORMALIZE_ERROR'
  | 'DETECTION_ERROR'
  | 'PDF_GENERATION_ERROR'
  | 'EXPORT_ERROR'
  | 'WORKER_ERROR'
  | 'UNKNOWN_ERROR';

/** Error estructurado expuesto a la UI con información accionable */
export interface AppError {
  code: AppErrorCode;
  /** Descripción del problema en español, legible para el usuario */
  message: string;
  /** Causa técnica del error */
  cause: string;
  /** Acción correctiva sugerida al usuario */
  suggestedAction: string;
}

// ---------------------------------------------------------------------------
// Store Zustand
// ---------------------------------------------------------------------------

/** Contrato completo del store de sesión (estado + acciones + selectores) */
export interface SessionStore extends ActiveSession {
  // Acciones
  loadFile: (file: File) => Promise<void>;
  clearSession: () => void;
  setFilters: (filters: Partial<ActiveFilters>) => void;
  resetFilters: () => void;
  // Selectores derivados
  filteredIncidents: () => Incident[];
  incidentsByRiskLevel: () => Record<RiskLevel, number>;
}
