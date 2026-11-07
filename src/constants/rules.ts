import type {
  RiskLevel,
  RuleConfig,
  DetectionRule,
  NormalizedRecord,
  DetectionContext,
} from '../types';

// ============================================================
// Paleta de colores por nivel de riesgo
// ============================================================

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string }> = {
  CRÍTICO:     { bg: '#B91C1C', text: '#FFFFFF' }, // Rojo
  ALTO:        { bg: '#C2410C', text: '#FFFFFF' }, // Naranja
  MEDIO:       { bg: '#B45309', text: '#FFFFFF' }, // Amarillo oscuro
  BAJO:        { bg: '#15803D', text: '#FFFFFF' }, // Verde
  INFORMATIVO: { bg: '#1D4ED8', text: '#FFFFFF' }, // Azul
} as const;

// ============================================================
// Tema oscuro de la aplicación
// ============================================================

export const THEME = {
  background:  '#0F172A', // Azul muy oscuro (slate-900)
  surface:     '#1E293B', // Azul oscuro (slate-800)
  border:      '#334155', // Slate-700
  textPrimary: '#F1F5F9', // Slate-100
  textMuted:   '#94A3B8', // Slate-400
  accent:      '#3B82F6', // Azul (blue-500)
} as const;

// ============================================================
// Configuración por defecto del motor de reglas
// ============================================================

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  workingHours: {
    start: 8,                     // 08:00 hora local
    end: 18,                      // 18:00 hora local
    daysOfWeek: [1, 2, 3, 4, 5], // Lunes (1) a Viernes (5)
  },
  bruteForce: {
    threshold: 5,     // 5 o más intentos fallidos
    windowMinutes: 10, // dentro de una ventana de 10 minutos
  },
};

// ============================================================
// Orden de severidad (mayor número = mayor severidad)
// ============================================================

export const severityOrder: Record<RiskLevel, number> = {
  CRÍTICO:     5,
  ALTO:        4,
  MEDIO:       3,
  BAJO:        2,
  INFORMATIVO: 1,
} as const;

// ============================================================
// Helpers internos de evaluación
// ============================================================

/** Devuelve el valor normalizado de un campo como string en minúsculas, o null si ausente/no parseable */
function getFieldString(record: NormalizedRecord, field: keyof NormalizedRecord['fields']): string | null {
  const f = record.fields[field];
  if (!f || f.status === 'absent') return null;
  return String(f.normalized ?? f.raw).toLowerCase().trim();
}

/** Verifica si el valor normalizado de un campo contiene alguno de los textos indicados */
function fieldContains(record: NormalizedRecord, field: keyof NormalizedRecord['fields'], values: string[]): boolean {
  const val = getFieldString(record, field);
  if (val === null) return false;
  return values.some(v => val.includes(v));
}

/** Determina si un timestamp cae fuera del horario laboral según la configuración */
function isAfterHours(isoTimestamp: string, config: RuleConfig): boolean {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return false;

  // getDay() devuelve 0=Domingo, 1=Lunes … 6=Sábado
  // La config usa 1=Lunes … 7=Domingo para consistencia con ISO 8601
  const rawDay = date.getDay(); // 0-6
  const isoDay = rawDay === 0 ? 7 : rawDay; // convertir a 1-7
  const hour = date.getHours();

  const isWorkday = config.workingHours.daysOfWeek.includes(isoDay);
  const isWorkHour = hour >= config.workingHours.start && hour < config.workingHours.end;

  return !(isWorkday && isWorkHour);
}

// ============================================================
// Definición de las 5 reglas de detección
// ============================================================

/**
 * AUTH_FAILURE — Intento fallido de autenticación
 * Severidad: MEDIO
 * Campos requeridos: status
 */
const authFailureRule: DetectionRule = {
  id: 'AUTH_FAILURE',
  name: 'Intento fallido de autenticación',
  severity: 'MEDIO',
  requiredFields: ['status'],
  evaluate(record: NormalizedRecord, _context: DetectionContext): boolean {
    return fieldContains(record, 'status', [
      'failed', 'failure', 'fail',
      'falló', 'fallido', 'fallo',
      'authentication failed', 'auth failed',
      'login failed', 'error',
      'denied', 'denegado', 'rechazado',
      'incorrect', 'incorrecto', 'invalido', 'inválido',
      'invalid', 'wrong', 'bad credentials',
      '0x0', // Windows logon failure codes
      'failure audit',
    ]);
  },
};

/**
 * UNAUTHORIZED_ACCESS — Acceso no autorizado
 * Severidad: ALTO
 * Campos requeridos: status, description
 */
const unauthorizedAccessRule: DetectionRule = {
  id: 'UNAUTHORIZED_ACCESS',
  name: 'Acceso no autorizado',
  severity: 'ALTO',
  requiredFields: ['status', 'description'],
  evaluate(record: NormalizedRecord, _context: DetectionContext): boolean {
    const statusMatch = fieldContains(record, 'status', [
      'unauthorized', 'no autorizado', 'forbidden', 'prohibido',
      'access denied', 'acceso denegado', '401', '403',
      'denied', 'denegado', 'blocked', 'bloqueado',
      'insufficient privileges', 'sin privilegios',
    ]);
    const descMatch = fieldContains(record, 'description', [
      'unauthorized', 'no autorizado', 'forbidden', 'prohibido',
      'access denied', 'acceso denegado', 'denied', 'denegado',
    ]);
    return statusMatch || descMatch;
  },
};

/**
 * AFTER_HOURS — Actividad fuera de horario laboral
 * Severidad: BAJO
 * Campos requeridos: timestamp
 */
const afterHoursRule: DetectionRule = {
  id: 'AFTER_HOURS',
  name: 'Actividad fuera de horario laboral',
  severity: 'BAJO',
  requiredFields: ['timestamp'],
  evaluate(record: NormalizedRecord, context: DetectionContext): boolean {
    const ts = record.fields['timestamp'];
    if (!ts || ts.status !== 'ok') return false;
    const isoValue = String(ts.normalized);
    return isAfterHours(isoValue, context.config);
  },
};

/**
 * BRUTE_FORCE — Ataque de fuerza bruta
 * Severidad: CRÍTICO
 * Campos requeridos: sourceIP, status, timestamp
 *
 * NOTA: Esta regla usa el contexto de todos los registros (allRecords) para
 * aplicar la ventana deslizante O(n). La evaluación por registro devuelve true
 * únicamente para los registros de IPs que superaron el umbral.
 * El conjunto de IPs de fuerza bruta se calcula una sola vez por llamada al
 * motor de detección y se guarda en el contexto para eficiencia.
 */
const bruteForceRule: DetectionRule = {
  id: 'BRUTE_FORCE',
  name: 'Ataque de fuerza bruta',
  severity: 'CRÍTICO',
  requiredFields: ['sourceIP', 'status', 'timestamp'],
  evaluate(record: NormalizedRecord, context: DetectionContext): boolean {
    // Verificar que este registro tiene los campos requeridos disponibles
    const sourceIPField = record.fields['sourceIP'];
    const statusField   = record.fields['status'];
    const tsField       = record.fields['timestamp'];

    if (!sourceIPField || sourceIPField.status === 'absent') return false;
    if (!statusField   || statusField.status === 'absent')   return false;
    if (!tsField       || tsField.status === 'absent')       return false;

    // Solo considerar registros con estado de autenticación fallida
    const statusVal = String(statusField.normalized ?? statusField.raw).toLowerCase();
    const isFailure = ['failed', 'failure', 'fail', 'falló', 'fallido', 'fallo',
      'authentication failed', 'auth failed', 'login failed'].some(s => statusVal.includes(s));
    if (!isFailure) return false;

    const thisIP = String(sourceIPField.normalized ?? sourceIPField.raw).trim();

    // Recopilar todos los eventos fallidos de esta IP con timestamp válido
    const ipEvents: number[] = [];
    for (const r of context.allRecords) {
      const ip  = r.fields['sourceIP'];
      const st  = r.fields['status'];
      const tss = r.fields['timestamp'];

      if (!ip || ip.status === 'absent') continue;
      if (String(ip.normalized ?? ip.raw).trim() !== thisIP) continue;
      if (!st || st.status === 'absent') continue;

      const stVal = String(st.normalized ?? st.raw).toLowerCase();
      const isFail = ['failed', 'failure', 'fail', 'falló', 'fallido', 'fallo',
        'authentication failed', 'auth failed', 'login failed'].some(s => stVal.includes(s));
      if (!isFail) continue;

      if (!tss || tss.status !== 'ok') continue;
      const t = new Date(String(tss.normalized)).getTime();
      if (!isNaN(t)) ipEvents.push(t);
    }

    // Algoritmo de ventana deslizante O(n)
    const windowMs = context.config.bruteForce.windowMinutes * 60 * 1000;
    const threshold = context.config.bruteForce.threshold;
    ipEvents.sort((a, b) => a - b);

    let left = 0;
    for (let right = 0; right < ipEvents.length; right++) {
      while (ipEvents[right] - ipEvents[left] > windowMs) {
        left++;
      }
      if (right - left + 1 >= threshold) return true;
    }

    return false;
  },
};

/**
 * CRITICAL_SEVERITY — Evento de severidad crítica
 * Severidad: CRÍTICO
 * Campos requeridos: severity
 *
 * Solo se dispara si el campo severity contiene explícitamente
 * "critical", "crítico" o "crit" (case-insensitive).
 */
const criticalSeverityRule: DetectionRule = {
  id: 'CRITICAL_SEVERITY',
  name: 'Evento de severidad crítica',
  severity: 'CRÍTICO',
  requiredFields: ['severity'],
  evaluate(record: NormalizedRecord, _context: DetectionContext): boolean {
    const sevField = record.fields['severity'];
    if (!sevField || sevField.status === 'absent') return false;

    const val = String(sevField.normalized ?? sevField.raw).toLowerCase().trim();
    // Severidades críticas explícitas
    if (val === 'critical' || val === 'crítico' || val === 'crit' ||
        val.includes('critical') || val.includes('crítico') || val.includes('crit')) return true;
    // Severidad High del Excel de laboratorio
    if (val === 'high' || val === 'alto') return true;
    return false;
  },
};

// ============================================================
// Lista ordenada de reglas de detección
// ============================================================

/**
 * HIGH_SEVERITY_EVENT — Evento de severidad alta (Warning/Medium del SIEM)
 * Severidad: ALTO
 * Campos requeridos: severity
 * Detecta eventos marcados como Warning o Medium que indican actividad sospechosa
 */
const highSeverityRule: DetectionRule = {
  id: 'HIGH_SEVERITY_EVENT',
  name: 'Evento de severidad alta',
  severity: 'ALTO',
  requiredFields: ['severity'],
  evaluate(record: NormalizedRecord, _context: DetectionContext): boolean {
    const sevField = record.fields['severity'];
    if (!sevField || sevField.status === 'absent') return false;
    const val = String(sevField.normalized ?? sevField.raw).toLowerCase().trim();
    return val === 'warning' || val === 'warn' || val === 'medium' ||
           val === 'medio' || val === 'advertencia';
  },
};

export const DETECTION_RULES: DetectionRule[] = [
  authFailureRule,
  unauthorizedAccessRule,
  highSeverityRule,
  afterHoursRule,
  bruteForceRule,
  criticalSeverityRule,
];
