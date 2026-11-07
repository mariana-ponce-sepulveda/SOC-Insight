/**
 * Estadísticas del dashboard — SOC Incident Analyzer
 *
 * Funciones de cálculo para los widgets del dashboard:
 *   - Distribución de incidentes por nivel de riesgo
 *   - Agrupación temporal dinámica (por hora ≤ 48 h, por día > 48 h)
 *   - Top-N IPs de origen
 *   - Top-N tipos de evento
 *   - Distribución porcentual por nivel de riesgo
 */

import type { Incident, NormalizedRecord, RiskLevel } from '../../types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ALL_RISK_LEVELS: RiskLevel[] = [
  'CRÍTICO',
  'ALTO',
  'MEDIO',
  'BAJO',
  'INFORMATIVO',
];

/** 48 horas expresadas en segundos */
const FORTY_EIGHT_HOURS_S = 172_800;

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export interface TemporalBucket {
  /** Etiqueta legible: "YYYY-MM-DD HH:00" (por hora) o "YYYY-MM-DD" (por día) */
  label: string;
  /** Número de registros que caen en este bucket */
  count: number;
  /** Timestamp Unix del inicio del bucket en milisegundos (para ordenación y ejes) */
  timestamp: number;
}

export interface RankedItem {
  /** Valor del campo (IP o tipo de evento) */
  value: string;
  /** Número de ocurrencias */
  count: number;
}

// ---------------------------------------------------------------------------
// 1. calcIncidentsByRiskLevel
// ---------------------------------------------------------------------------

/**
 * Cuenta incidentes por cada nivel de riesgo.
 * Los niveles con 0 incidentes están presentes en el resultado con valor 0.
 */
export function calcIncidentsByRiskLevel(
  incidents: Incident[],
): Record<RiskLevel, number> {
  const result = {} as Record<RiskLevel, number>;

  // Inicializar todos los niveles en 0
  for (const level of ALL_RISK_LEVELS) {
    result[level] = 0;
  }

  for (const incident of incidents) {
    result[incident.riskLevel] += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. calcTemporalGroups
// ---------------------------------------------------------------------------

/**
 * Agrupa registros en buckets temporales para el gráfico de línea de tiempo.
 *
 * - Solo usa registros donde `timestamp.status === 'ok'`.
 * - Si rango total ≤ 48 h (172 800 s) → buckets por HORA, etiqueta "YYYY-MM-DD HH:00".
 * - Si rango total > 48 h → buckets por DÍA, etiqueta "YYYY-MM-DD".
 * - Devuelve buckets ordenados cronológicamente.
 * - Si no hay timestamps válidos devuelve [].
 */
export function calcTemporalGroups(
  records: NormalizedRecord[],
): TemporalBucket[] {
  // Recopilar timestamps válidos en ms
  const validMs: number[] = [];
  for (const record of records) {
    const ts = record.fields['timestamp'];
    if (!ts || ts.status !== 'ok') continue;
    const ms = new Date(String(ts.normalized)).getTime();
    if (!isNaN(ms)) validMs.push(ms);
  }

  if (validMs.length === 0) return [];

  const minMs = Math.min(...validMs);
  const maxMs = Math.max(...validMs);
  const rangeSeconds = (maxMs - minMs) / 1000;

  const byHour = rangeSeconds <= FORTY_EIGHT_HOURS_S;

  // Función que produce la clave de bucket y su timestamp de inicio
  function getBucketKey(ms: number): { key: string; bucketStart: number } {
    const d = new Date(ms);
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');

    if (byHour) {
      const hour = String(d.getHours()).padStart(2, '0');
      const key  = `${year}-${month}-${day} ${hour}:00`;
      // Inicio del bucket: mismo año/mes/día/hora, minutos y segundos a 0
      const bucketStart = new Date(year, d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0).getTime();
      return { key, bucketStart };
    } else {
      const key  = `${year}-${month}-${day}`;
      const bucketStart = new Date(year, d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
      return { key, bucketStart };
    }
  }

  // Acumular conteos por clave de bucket
  const bucketMap = new Map<string, { count: number; timestamp: number }>();

  for (const ms of validMs) {
    const { key, bucketStart } = getBucketKey(ms);
    const existing = bucketMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      bucketMap.set(key, { count: 1, timestamp: bucketStart });
    }
  }

  // Convertir a array y ordenar cronológicamente
  const buckets: TemporalBucket[] = Array.from(bucketMap.entries()).map(
    ([label, { count, timestamp }]) => ({ label, count, timestamp }),
  );

  buckets.sort((a, b) => a.timestamp - b.timestamp);

  return buckets;
}

// ---------------------------------------------------------------------------
// 3. calcTopIPs
// ---------------------------------------------------------------------------

/**
 * Calcula las top-N IPs de origen más frecuentes.
 *
 * - Solo cuenta registros donde `sourceIP.status !== 'absent'`.
 * - Devuelve top `n` (default 10) en orden descendente de conteo.
 * - La longitud del resultado es `min(IPs distintas, n)`.
 */
export function calcTopIPs(
  records: NormalizedRecord[],
  n = 10,
): RankedItem[] {
  return calcTopField(records, 'sourceIP', n);
}

// ---------------------------------------------------------------------------
// 4. calcTopEventTypes
// ---------------------------------------------------------------------------

/**
 * Calcula los top-N tipos de evento más frecuentes.
 *
 * - Solo cuenta registros donde `eventType.status !== 'absent'`.
 * - Devuelve top `n` (default 10) en orden descendente de conteo.
 * - La longitud del resultado es `min(tipos distintos, n)`.
 */
export function calcTopEventTypes(
  records: NormalizedRecord[],
  n = 10,
): RankedItem[] {
  return calcTopField(records, 'eventType', n);
}

// ---------------------------------------------------------------------------
// Helper compartido para top-N de un campo genérico
// ---------------------------------------------------------------------------

function calcTopField(
  records: NormalizedRecord[],
  field: 'sourceIP' | 'eventType',
  n: number,
): RankedItem[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    const f = record.fields[field];
    if (!f || f.status === 'absent') continue;

    const value = String(f.normalized ?? f.raw).trim();
    if (value === '') continue;

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const items: RankedItem[] = Array.from(counts.entries()).map(
    ([value, count]) => ({ value, count }),
  );

  // Ordenar de mayor a menor conteo; en caso de empate, orden lexicográfico estable
  items.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return items.slice(0, n);
}

// ---------------------------------------------------------------------------
// 5. calcRiskDistribution
// ---------------------------------------------------------------------------

/**
 * Calcula la distribución de incidentes por nivel de riesgo con porcentajes.
 *
 * - Cada entrada tiene `count` y `percentage` (0-100 con 2 decimales).
 * - Solo incluye niveles con count > 0.
 * - Si no hay incidentes devuelve [].
 */
export function calcRiskDistribution(
  incidents: Incident[],
): Array<{ riskLevel: RiskLevel; count: number; percentage: number }> {
  if (incidents.length === 0) return [];

  const counts = calcIncidentsByRiskLevel(incidents);
  const total  = incidents.length;

  const result: Array<{ riskLevel: RiskLevel; count: number; percentage: number }> = [];

  for (const level of ALL_RISK_LEVELS) {
    const count = counts[level];
    if (count === 0) continue;

    const percentage = parseFloat(((count / total) * 100).toFixed(2));
    result.push({ riskLevel: level, count, percentage });
  }

  return result;
}
