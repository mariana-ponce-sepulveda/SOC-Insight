/**
 * Motor de detección de incidentes — SOC Incident Analyzer
 *
 * Aplica las 5 reglas definidas en `src/constants/rules.ts` sobre un lote de
 * `NormalizedRecord[]` y produce un `DetectionResult` con los incidentes
 * detectados y las reglas omitidas por campos ausentes.
 *
 * Estrategia de agrupación:
 *   - Un incidente por registro que active ≥ 1 regla.
 *   - Si un registro activa múltiples reglas → un solo incidente con el nivel
 *     de mayor severidad y un `reason` que lista todas las reglas disparadas.
 *   - Los registros de respaldo (`evidenceRecords`) conservan todos los campos
 *     originales tal como fueron normalizados (ningún campo se modifica).
 */

import type {
  NormalizedRecord,
  RuleConfig,
  DetectionResult,
  Incident,
  SkippedRule,
  TriggeredRule,
  RiskLevel,
  DetectionContext,
} from '../../types';

import { DETECTION_RULES, severityOrder } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el campo `field` está disponible (status !== 'absent') en
 * AL MENOS UNO de los registros del lote.
 */
function fieldAvailableInAnyRecord(
  records: NormalizedRecord[],
  field: keyof NormalizedRecord['fields'],
): boolean {
  for (const record of records) {
    const f = record.fields[field];
    if (f && f.status !== 'absent') return true;
  }
  return false;
}

/**
 * Determina si todos los campos requeridos por una regla están disponibles
 * en al menos un registro del lote.
 *
 * Si TODOS los campos requeridos tienen status 'absent' en TODOS los registros,
 * la regla se omite (SkippedRule). De lo contrario, la regla se evalúa.
 *
 * Devuelve el array de campos que están ausentes en todos los registros,
 * o un array vacío si la regla puede ejecutarse.
 */
function getMissingFields(
  records: NormalizedRecord[],
  requiredFields: Array<keyof NormalizedRecord['fields']>,
): Array<keyof NormalizedRecord['fields']> {
  return requiredFields.filter(
    (field) => !fieldAvailableInAnyRecord(records, field),
  );
}

/**
 * Obtiene el nivel de riesgo de mayor severidad entre un conjunto de reglas disparadas.
 */
function getMaxRiskLevel(rules: TriggeredRule[]): RiskLevel {
  return rules.reduce<RiskLevel>(
    (max, rule) =>
      severityOrder[rule.severity] > severityOrder[max] ? rule.severity : max,
    'INFORMATIVO',
  );
}

/**
 * Construye el texto legible del motivo de clasificación a partir de las reglas
 * disparadas. Formato: "Nombre de Regla 1, Nombre de Regla 2 [NIVEL]"
 */
function buildReason(rules: TriggeredRule[], riskLevel: RiskLevel): string {
  const names = rules.map((r) => r.ruleName).join(', ');
  return `${names} [${riskLevel}]`;
}

/**
 * Extrae el timestamp ISO 8601 de un registro, o null si no está disponible.
 */
function getTimestamp(record: NormalizedRecord): string | null {
  const ts = record.fields['timestamp'];
  if (!ts || ts.status !== 'ok') return null;
  const val = String(ts.normalized);
  return val.length > 0 ? val : null;
}

/**
 * Calcula el primer y último timestamp entre un conjunto de registros de
 * evidencia. Devuelve null en ambos campos si ningún registro tiene timestamp.
 */
function getTimestampRange(
  evidenceRecords: NormalizedRecord[],
): { firstTimestamp: string | null; lastTimestamp: string | null } {
  const timestamps: number[] = [];

  for (const record of evidenceRecords) {
    const iso = getTimestamp(record);
    if (iso !== null) {
      const ms = new Date(iso).getTime();
      if (!isNaN(ms)) timestamps.push(ms);
    }
  }

  if (timestamps.length === 0) {
    return { firstTimestamp: null, lastTimestamp: null };
  }

  const minMs = Math.min(...timestamps);
  const maxMs = Math.max(...timestamps);

  return {
    firstTimestamp: new Date(minMs).toISOString(),
    lastTimestamp: new Date(maxMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Función principal exportada
// ---------------------------------------------------------------------------

/**
 * Ejecuta el motor de detección de incidentes sobre un lote de registros
 * normalizados.
 *
 * @param records  Registros normalizados producidos por la capa de normalización.
 * @param config   Configuración del motor (horario laboral, umbrales de fuerza bruta).
 * @returns        `DetectionResult` con `incidents` y `skippedRules`.
 */
export function detectIncidents(
  records: NormalizedRecord[],
  config: RuleConfig,
): DetectionResult {
  const incidents: Incident[] = [];
  const skippedRules: SkippedRule[] = [];

  if (records.length === 0) {
    return { incidents, skippedRules };
  }

  // Contexto compartido para todas las evaluaciones de este lote
  const context: DetectionContext = {
    config,
    allRecords: records,
  };

  // Determinar qué reglas pueden ejecutarse en este lote
  const executableRules: typeof DETECTION_RULES = [];

  for (const rule of DETECTION_RULES) {
    const missingFields = getMissingFields(records, rule.requiredFields);
    if (missingFields.length > 0) {
      // Todos los campos requeridos están ausentes en todos los registros
      skippedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        missingFields,
      });
    } else {
      executableRules.push(rule);
    }
  }

  // Evaluar cada registro contra las reglas ejecutables
  for (const record of records) {
    const triggeredRules: TriggeredRule[] = [];

    for (const rule of executableRules) {
      // Verificar que este registro específico tiene los campos requeridos
      // (la regla puede estar disponible en el lote pero no en este registro puntual)
      const recordHasRequiredFields = rule.requiredFields.every((field) => {
        const f = record.fields[field];
        return f !== undefined && f.status !== 'absent';
      });

      if (!recordHasRequiredFields) {
        // El registro no tiene los campos necesarios → omitir la regla para este registro
        continue;
      }

      let fired: boolean;
      try {
        fired = rule.evaluate(record, context);
      } catch {
        // Error inesperado en la función de evaluación → omitir esta regla para este registro
        fired = false;
      }

      if (fired) {
        triggeredRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
        });
      }
    }

    // Solo crear incidente si al menos una regla se disparó
    if (triggeredRules.length === 0) continue;

    const riskLevel = getMaxRiskLevel(triggeredRules);
    const reason = buildReason(triggeredRules, riskLevel);
    const { firstTimestamp, lastTimestamp } = getTimestampRange([record]);

    const incident: Incident = {
      id: crypto.randomUUID(),
      riskLevel,
      reason,
      triggeredRules,
      evidenceRecords: [record],
      firstTimestamp,
      lastTimestamp,
    };

    incidents.push(incident);
  }

  return { incidents, skippedRules };
}
