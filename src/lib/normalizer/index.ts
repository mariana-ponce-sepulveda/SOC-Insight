/**
 * Capa de normalización — SOC Incident Analyzer
 *
 * Convierte las filas crudas del parser en `NormalizedRecord[]` aplicando:
 *  - Mapeo de encabezados a `RecognizedField` (case-insensitive + sinónimos)
 *  - Normalización de fechas a ISO 8601
 *  - Marcado de campos ausentes como 'absent'
 *  - Preservación de columnas no reconocidas en `extra`
 *  - Omisión de filas que lancen excepción durante el procesamiento
 */

import type {
  RawRow,
  RecognizedField,
  NormalizedRecord,
  NormalizedFieldValue,
  ParseWarning,
} from '../../types';

// ---------------------------------------------------------------------------
// Diccionario de sinónimos por campo reconocido
// ---------------------------------------------------------------------------

const FIELD_SYNONYMS: Record<RecognizedField, string[]> = {
  timestamp: [
    'fecha',
    'date',
    'time',
    'timestamp',
    'datetime',
    'hora',
    'fecha/hora',
    'fecha hora',
    'fecha_hora',
    'fecha_evento',
    'event_time',
    'event_date',
    'log_date',
    'log_time',
    'tiempo',
    'fecha registro',
    'fecha_registro',
  ],
  sourceIP: [
    'ip origen',
    'source ip',
    'src ip',
    'ip_origen',
    'sourceip',
    'ip de origen',
    'source address',
    'src_ip',
    'source_ip',
    'ip_fuente',
    'direccion origen',
    'direccion_origen',
    'client ip',
    'client_ip',
    'clientip',
    'remote_ip',
    'remote ip',
    'ip_cliente',
    'origen_ip',
  ],
  destinationIP: [
    'ip destino',
    'dest ip',
    'destination ip',
    'ip_destino',
    'destip',
    'dst_ip',
    'dst ip',
    'dest_ip',
    'destination_ip',
    'server_ip',
    'server ip',
    'target_ip',
    'target ip',
  ],
  user: [
    'usuario',
    'user',
    'username',
    'nombre de usuario',
    'account',
    'user_name',
    'nombre_usuario',
    'login',
    'login_user',
    'usuario_origen',
    'user_id',
    'userid',
    'nombre usuario',
    'cuenta',
    'account_name',
    'subject_user',
    'target_user',
  ],
  eventType: [
    'tipo de evento',
    'event type',
    'eventtype',
    'tipo',
    'event',
    'event_type',
    'tipo_evento',
    'categoria',
    'category',
    'event_id',
    'eventid',
    'accion',
    'action',
    'actividad',
    'vector',
    'vector_ataque',
    'tipo_acceso',
  ],
  sourceSystem: [
    'sistema',
    'source',
    'system',
    'origin',
    'origen',
    'host',
    'hostname',
    'equipo',
    'computadora',
    'machine',
    'source_system',
    'sistema_origen',
    'fuente',
    'device',
    'log_source',
    'sensor',
  ],
  description: [
    'descripcion',
    'descripción',
    'description',
    'mensaje',
    'message',
    'detalle',
    'detail',
    'details',
    'info',
    'information',
    'event_description',
    'msg',
    'texto',
    'contenido',
    'event_message',
    'log_message',
  ],
  status: [
    'estado',
    'status',
    'result',
    'resultado',
    'outcome',
    'resultado_autenticacion',
    'login_result',
    'auth_result',
    'estado_autenticacion',
    'logon_type',
    'success_failure',
    'estado_sesion',
    'resultado_acceso',
    'access_result',
    'response',
    'respuesta',
  ],
  severity: [
    'severidad',
    'severity',
    'nivel',
    'level',
    'prioridad',
    'priority',
    'criticidad',
    'criticalidad',
    'risk_level',
    'nivel_riesgo',
    'nivel_criticidad',
    'impact',
    'impacto',
    'nivel_severidad',
    'alert_level',
  ],
};

// ---------------------------------------------------------------------------
// Índice invertido: alias (lowercase) → RecognizedField
// Construido una sola vez al cargar el módulo.
// ---------------------------------------------------------------------------

const ALIAS_TO_FIELD: Map<string, RecognizedField> = new Map();

for (const [field, aliases] of Object.entries(FIELD_SYNONYMS) as [RecognizedField, string[]][]) {
  for (const alias of aliases) {
    ALIAS_TO_FIELD.set(alias.toLowerCase(), field);
  }
}

// ---------------------------------------------------------------------------
// Resolución de encabezado → RecognizedField (o undefined si no reconocido)
// ---------------------------------------------------------------------------

function resolveField(header: string): RecognizedField | undefined {
  return ALIAS_TO_FIELD.get(header.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Normalización de fechas
// ---------------------------------------------------------------------------

/**
 * Intenta parsear `value` como fecha.
 * - Si es un número (timestamp Unix en segundos o milisegundos): convierte primero.
 * - Si `new Date(value)` produce una fecha válida → ISO 8601.
 * - En caso contrario → conservar original, status 'unparseable'.
 */
function normalizeDate(raw: unknown): NormalizedFieldValue {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { raw, normalized: undefined, status: 'absent' };
  }

  let dateCandidate: Date | null = null;

  if (typeof raw === 'number') {
    // SheetJS puede entregar fechas como números seriales de Excel (días desde 1900-01-01)
    // o como timestamps Unix. Heurística: si el número es < 2.958.465 (año 9999 en Excel
    // serial) y razonable para una fecha laboral (> 1 → posterior a 1900-01-01), podemos
    // tratarlo como serial de Excel.  De lo contrario lo tratamos como Unix timestamp.
    // Para simplificar y ser robustos, confiamos en que SheetJS ya entregue el valor como
    // Date o string cuando usa `cellDates: true`. Si llega como número, usamos ms si >
    // 1e10 (Unix ms) y s si entre 1e8 y 1e10 (Unix s).
    if (raw > 1e10) {
      // Probablemente Unix timestamp en milisegundos
      dateCandidate = new Date(raw);
    } else if (raw > 1e8) {
      // Probablemente Unix timestamp en segundos
      dateCandidate = new Date(raw * 1000);
    } else {
      // Número pequeño — intentar conversión directa (podría ser serial Excel)
      dateCandidate = new Date(raw);
    }
  } else if (raw instanceof Date) {
    dateCandidate = raw;
  } else if (typeof raw === 'string') {
    const str = raw.trim();
    if (str === '') {
      return { raw, normalized: undefined, status: 'absent' };
    }
    dateCandidate = new Date(str);
  }

  if (dateCandidate !== null && !isNaN(dateCandidate.getTime())) {
    // Serializar en ISO 8601 con offset local
    const iso = toLocalISO(dateCandidate);
    return { raw, normalized: iso, status: 'ok' };
  }

  // No parseable
  return { raw, normalized: raw, status: 'unparseable' };
}

/**
 * Convierte un objeto `Date` a ISO 8601 con offset local (YYYY-MM-DDTHH:MM:SS±HH:MM).
 * Se usa formato local para no perder la información de zona del sistema.
 */
function toLocalISO(date: Date): string {
  const pad = (n: number, length = 2): string => String(n).padStart(length, '0');

  const year   = date.getFullYear();
  const month  = pad(date.getMonth() + 1);
  const day    = pad(date.getDate());
  const hours  = pad(date.getHours());
  const mins   = pad(date.getMinutes());
  const secs   = pad(date.getSeconds());

  const offsetTotalMinutes = -date.getTimezoneOffset(); // getTimezoneOffset devuelve -offset
  const sign   = offsetTotalMinutes >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetTotalMinutes);
  const offH   = pad(Math.floor(absOff / 60));
  const offM   = pad(absOff % 60);

  return `${year}-${month}-${day}T${hours}:${mins}:${secs}${sign}${offH}:${offM}`;
}

// ---------------------------------------------------------------------------
// Normalización de un valor genérico (no fecha)
// ---------------------------------------------------------------------------

function normalizeGenericField(raw: unknown): NormalizedFieldValue {
  if (raw === undefined || raw === null) {
    return { raw, normalized: undefined, status: 'absent' };
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return { raw, normalized: undefined, status: 'absent' };
  }
  const normalized = typeof raw === 'string' ? raw.trim() : String(raw);
  return { raw, normalized, status: 'ok' };
}

// ---------------------------------------------------------------------------
// Función principal exportada
// ---------------------------------------------------------------------------

/**
 * Normaliza un lote de filas crudas con sus encabezados.
 *
 * @param headers  Array de nombres de columna tal como vienen del parser.
 * @param rows     Filas crudas (una entrada por fila, índices 0-based).
 * @returns        Array de `NormalizedRecord`. Las filas que lancen una
 *                 excepción durante su procesamiento son omitidas del resultado.
 */
export function normalizeRecords(headers: string[], rows: RawRow[]): NormalizedRecord[] {
  // Precalcular el mapeo de índice de columna → RecognizedField (o undefined)
  const columnMap: Array<RecognizedField | undefined> = headers.map(resolveField);

  // Conjunto de campos reconocidos presentes en este archivo
  const presentFields = new Set<RecognizedField>(
    columnMap.filter((f): f is RecognizedField => f !== undefined),
  );

  // Todos los RecognizedFields posibles
  const ALL_FIELDS: RecognizedField[] = [
    'timestamp',
    'sourceIP',
    'destinationIP',
    'user',
    'eventType',
    'sourceSystem',
    'description',
    'status',
    'severity',
  ];

  // Campos reconocidos que NO están presentes → siempre 'absent'
  const absentFields = ALL_FIELDS.filter((f) => !presentFields.has(f));

  const result: NormalizedRecord[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    try {
      const row = rows[rowIndex];

      const fields: Partial<Record<RecognizedField, NormalizedFieldValue>> = {};
      const extra: Record<string, unknown> = {};
      const parseWarnings: ParseWarning[] = [];

      // Recorrer cada columna de la fila
      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const header = headers[colIdx];
        const recognizedField = columnMap[colIdx];
        const rawValue = row[header];

        if (recognizedField !== undefined) {
          // Campo reconocido
          let fieldValue: NormalizedFieldValue;

          if (recognizedField === 'timestamp') {
            fieldValue = normalizeDate(rawValue);
            if (fieldValue.status === 'unparseable') {
              parseWarnings.push({
                field: recognizedField,
                message: `Fecha no normalizable: valor conservado como texto (columna "${header}", fila ${rowIndex + 1})`,
              });
            }
          } else {
            fieldValue = normalizeGenericField(rawValue);
          }

          fields[recognizedField] = fieldValue;
        } else {
          // Columna no reconocida → preservar en extra
          extra[header] = rawValue;
        }
      }

      // Marcar campos reconocidos ausentes (no presentes en el archivo)
      for (const field of absentFields) {
        fields[field] = { raw: undefined, normalized: undefined, status: 'absent' };
      }

      result.push({
        _rowIndex: rowIndex,
        fields,
        extra,
        parseWarnings,
      });
    } catch {
      // Fila ilegible — omitir sin interrumpir el flujo
      // (los errores de procesamiento se rastrean en el Worker, no aquí)
    }
  }

  return result;
}

/**
 * Devuelve el índice invertido de alias para uso en tests y depuración.
 * @internal
 */
export function _getAliasMap(): ReadonlyMap<string, RecognizedField> {
  return ALIAS_TO_FIELD;
}
