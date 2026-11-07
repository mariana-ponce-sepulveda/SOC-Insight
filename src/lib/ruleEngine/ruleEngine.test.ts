/**
 * Tests unitarios — Motor de detección de incidentes
 *
 * Cubre: BRUTE_FORCE, AFTER_HOURS, CRITICAL_SEVERITY y ausencia de falsos
 * positivos por campos ausentes.
 *
 * Feature: soc-incident-analyzer
 * Requisitos: 3.1, 3.5, 3.6, 3.7
 */

import { describe, it, expect } from 'vitest';
import { detectIncidents } from './index';
import type { NormalizedRecord, NormalizedFieldValue, RuleConfig } from '../../types';
import { DEFAULT_RULE_CONFIG } from '../../constants/rules';

// ---------------------------------------------------------------------------
// Helpers de construcción de registros de prueba
// ---------------------------------------------------------------------------

/**
 * Construye un NormalizedFieldValue con status 'ok'.
 */
function fieldOk(value: unknown): NormalizedFieldValue {
  return { raw: value, normalized: value, status: 'ok' };
}

/**
 * Construye un NormalizedFieldValue con status 'absent'.
 */
function fieldAbsent(): NormalizedFieldValue {
  return { raw: undefined, normalized: undefined, status: 'absent' };
}

let rowCounter = 0;

/**
 * Construye un NormalizedRecord mínimo con los campos indicados.
 * Los campos no proporcionados no se incluyen en el objeto `fields`.
 */
function makeRecord(
  fields: Partial<Record<string, NormalizedFieldValue>>,
): NormalizedRecord {
  return {
    _rowIndex: rowCounter++,
    fields: fields as NormalizedRecord['fields'],
    extra: {},
    parseWarnings: [],
  };
}

/**
 * Configuración base para los tests.
 * Horario laboral: lunes–viernes 08:00–18:00.
 * Fuerza bruta: 5 intentos en 10 minutos.
 */
const defaultConfig: RuleConfig = { ...DEFAULT_RULE_CONFIG };

// ---------------------------------------------------------------------------
// Helper para construir eventos de fuerza bruta
// ---------------------------------------------------------------------------

/**
 * Crea `count` registros de autenticación fallida para la misma IP,
 * distribuidos uniformemente dentro del intervalo dado (en minutos).
 *
 * @param ip      IP de origen compartida por todos los registros.
 * @param count   Número de registros.
 * @param startIso Timestamp ISO 8601 del primer evento.
 * @param spreadMinutes Rango total en minutos entre primer y último evento.
 */
function makeBruteForceRecords(
  ip: string,
  count: number,
  startIso: string,
  spreadMinutes: number,
): NormalizedRecord[] {
  const startMs = new Date(startIso).getTime();
  const intervalMs = count > 1 ? (spreadMinutes * 60 * 1000) / (count - 1) : 0;

  return Array.from({ length: count }, (_, i) => {
    const ts = new Date(startMs + i * intervalMs).toISOString();
    return makeRecord({
      sourceIP: fieldOk(ip),
      status: fieldOk('failed'),
      timestamp: fieldOk(ts),
    });
  });
}

// ---------------------------------------------------------------------------
// 1. BRUTE_FORCE — umbral exacto
// ---------------------------------------------------------------------------

describe('BRUTE_FORCE — ventana deslizante de 10 minutos', () => {
  const ip = '10.0.0.1';
  const start = '2024-01-15T09:00:00.000Z';

  it('NO se detecta con exactamente 4 intentos en 10 min', () => {
    const records = makeBruteForceRecords(ip, 4, start, 9);
    const { incidents } = detectIncidents(records, defaultConfig);
    const bruteForce = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'BRUTE_FORCE'),
    );
    expect(bruteForce).toHaveLength(0);
  });

  it('SÍ se detecta con exactamente 5 intentos en 10 min (CRÍTICO)', () => {
    const records = makeBruteForceRecords(ip, 5, start, 9);
    const { incidents } = detectIncidents(records, defaultConfig);
    const bruteForce = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'BRUTE_FORCE'),
    );
    expect(bruteForce.length).toBeGreaterThanOrEqual(1);
    // Al menos uno de los incidentes debe tener riskLevel CRÍTICO
    const hasCritical = bruteForce.some((inc) => inc.riskLevel === 'CRÍTICO');
    expect(hasCritical).toBe(true);
  });

  it('SÍ se detecta con 6 intentos en 10 min', () => {
    const records = makeBruteForceRecords(ip, 6, start, 9);
    const { incidents } = detectIncidents(records, defaultConfig);
    const bruteForce = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'BRUTE_FORCE'),
    );
    expect(bruteForce.length).toBeGreaterThanOrEqual(1);
  });

  it('NO se detecta cuando los 5 intentos están distribuidos en >10 min', () => {
    // 5 intentos separados por 3 minutos cada uno → ventana de 12 min
    const records = makeBruteForceRecords(ip, 5, start, 12);
    const { incidents } = detectIncidents(records, defaultConfig);
    const bruteForce = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'BRUTE_FORCE'),
    );
    expect(bruteForce).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. AFTER_HOURS — horario laboral
// ---------------------------------------------------------------------------

describe('AFTER_HOURS — actividad fuera de horario laboral', () => {
  /**
   * La regla AFTER_HOURS usa getDay() y getHours() — hora LOCAL del sistema.
   * Para que los tests sean deterministas en cualquier zona horaria, usamos
   * timestamps sin indicador de zona (interpretados como hora local por Date).
   */

  it('NO se dispara con timestamp dentro de horario laboral (martes 10:00 local)', () => {
    // 2024-01-16 es martes; hora local 10:00 → dentro del horario laboral 08–18
    const record = makeRecord({
      timestamp: fieldOk('2024-01-16T10:00:00'),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    const afterHours = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'AFTER_HOURS'),
    );
    expect(afterHours).toHaveLength(0);
  });

  it('SÍ se dispara con timestamp fuera de horario (sábado 14:00 local) — BAJO', () => {
    // 2024-01-20 es sábado; no está en los días laborables [1..5]
    const record = makeRecord({
      timestamp: fieldOk('2024-01-20T14:00:00'),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    const afterHours = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'AFTER_HOURS'),
    );
    expect(afterHours.length).toBeGreaterThanOrEqual(1);
    expect(afterHours[0].triggeredRules.find((r) => r.ruleId === 'AFTER_HOURS')?.severity).toBe(
      'BAJO',
    );
  });

  it('SÍ se dispara con timestamp en día laboral pero fuera de hora (lunes 03:00 local)', () => {
    // 2024-01-15 es lunes; hora local 03:00 → antes de las 08:00
    const record = makeRecord({
      timestamp: fieldOk('2024-01-15T03:00:00'),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    const afterHours = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'AFTER_HOURS'),
    );
    expect(afterHours.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. CRITICAL_SEVERITY — valores del campo severity
// ---------------------------------------------------------------------------

describe('CRITICAL_SEVERITY — campo severity', () => {
  it('SÍ se dispara con valor "critical" (minúsculas)', () => {
    const record = makeRecord({ severity: fieldOk('critical') });
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev.length).toBeGreaterThanOrEqual(1);
    expect(critSev[0].riskLevel).toBe('CRÍTICO');
  });

  it('SÍ se dispara con valor "CRITICAL" (mayúsculas)', () => {
    const record = makeRecord({ severity: fieldOk('CRITICAL') });
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev.length).toBeGreaterThanOrEqual(1);
  });

  it('SÍ se dispara con valor "crit"', () => {
    const record = makeRecord({ severity: fieldOk('crit') });
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev.length).toBeGreaterThanOrEqual(1);
  });

  it('NO se dispara con valor "high"', () => {
    const record = makeRecord({ severity: fieldOk('high') });
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev).toHaveLength(0);
  });

  it('NO se dispara con campo severity ausente', () => {
    const record = makeRecord({ severity: fieldAbsent() });
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev).toHaveLength(0);
  });

  it('NO se dispara cuando el campo severity no está presente en el registro', () => {
    // Sin la clave 'severity' en fields
    const record = makeRecord({});
    const { incidents } = detectIncidents([record], defaultConfig);
    const critSev = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'CRITICAL_SEVERITY'),
    );
    expect(critSev).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Campos ausentes — no deben generar falsos positivos
// ---------------------------------------------------------------------------

describe('Campos ausentes — sin falsos positivos', () => {
  it('Un registro completamente vacío no genera ningún incidente', () => {
    const record = makeRecord({});
    const { incidents } = detectIncidents([record], defaultConfig);
    expect(incidents).toHaveLength(0);
  });

  it('AUTH_FAILURE no se dispara cuando status está ausente', () => {
    const record = makeRecord({ status: fieldAbsent() });
    const { incidents } = detectIncidents([record], defaultConfig);
    const authFail = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'AUTH_FAILURE'),
    );
    expect(authFail).toHaveLength(0);
  });

  it('UNAUTHORIZED_ACCESS no se dispara cuando status y description están ausentes', () => {
    const record = makeRecord({
      status: fieldAbsent(),
      description: fieldAbsent(),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    const unauth = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'UNAUTHORIZED_ACCESS'),
    );
    expect(unauth).toHaveLength(0);
  });

  it('AFTER_HOURS no se dispara cuando timestamp está ausente', () => {
    const record = makeRecord({ timestamp: fieldAbsent() });
    const { incidents } = detectIncidents([record], defaultConfig);
    const afterHours = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'AFTER_HOURS'),
    );
    expect(afterHours).toHaveLength(0);
  });

  it('BRUTE_FORCE no se dispara cuando sourceIP, status y timestamp están ausentes', () => {
    const record = makeRecord({
      sourceIP: fieldAbsent(),
      status: fieldAbsent(),
      timestamp: fieldAbsent(),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    const bruteForce = incidents.filter((inc) =>
      inc.triggeredRules.some((r) => r.ruleId === 'BRUTE_FORCE'),
    );
    expect(bruteForce).toHaveLength(0);
  });

  it('Ninguna regla genera incidente cuando todos los campos requeridos están ausentes', () => {
    // Registro con todos los campos reconocidos marcados como 'absent'
    const record = makeRecord({
      timestamp: fieldAbsent(),
      sourceIP: fieldAbsent(),
      destinationIP: fieldAbsent(),
      user: fieldAbsent(),
      eventType: fieldAbsent(),
      sourceSystem: fieldAbsent(),
      description: fieldAbsent(),
      status: fieldAbsent(),
      severity: fieldAbsent(),
    });
    const { incidents } = detectIncidents([record], defaultConfig);
    expect(incidents).toHaveLength(0);
  });

  it('Las reglas con campos ausentes se registran en skippedRules del lote', () => {
    // Un lote donde TODOS los registros tienen todos los campos ausentes
    const record = makeRecord({
      timestamp: fieldAbsent(),
      sourceIP: fieldAbsent(),
      status: fieldAbsent(),
      description: fieldAbsent(),
      severity: fieldAbsent(),
    });
    const { skippedRules } = detectIncidents([record], defaultConfig);
    // Deben omitirse reglas que requieren campos ausentes en todos los registros
    expect(skippedRules.length).toBeGreaterThan(0);
  });
});
