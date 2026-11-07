/**
 * ReportDocument — Documento PDF del informe SOC Incident Analyzer
 *
 * Genera un documento PDF de 10 secciones usando @react-pdf/renderer.
 * Las secciones siguen el orden especificado en el diseño técnico:
 *   1. Portada
 *   2. Resumen ejecutivo
 *   3. Descripción del archivo analizado
 *   4. Metodología de análisis
 *   5. Estadísticas generales
 *   6. Listado de incidentes
 *   7. Evidencias y registros de respaldo
 *   8. IPs y usuarios involucrados
 *   9. Recomendaciones de mitigación
 *  10. Conclusiones
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ActiveSession, Incident, RiskLevel } from '../../types';
import type { RankedItem } from '../../lib/stats';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReportDocumentProps {
  session: ActiveSession;
  incidents: Incident[];
  stats: {
    byLevel: Record<RiskLevel, number>;
    topIPs: RankedItem[];
    topEventTypes: RankedItem[];
  };
  generatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Paleta de colores SOC
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<RiskLevel, string> = {
  CRÍTICO:     '#B91C1C',
  ALTO:        '#C2410C',
  MEDIO:       '#B45309',
  BAJO:        '#15803D',
  INFORMATIVO: '#1D4ED8',
};

const COLORS = {
  background:  '#0F172A',
  surface:     '#1E293B',
  border:      '#334155',
  textPrimary: '#F1F5F9',
  textMuted:   '#94A3B8',
  accent:      '#3B82F6',
  white:       '#FFFFFF',
  lightGray:   '#F8FAFC',
  gray:        '#E2E8F0',
} as const;

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1E293B',
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 45,
    backgroundColor: COLORS.white,
  },

  // ---- Portada ----
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: COLORS.background,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  coverContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  coverBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  coverBadgeText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 32,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontFamily: 'Helvetica',
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverDivider: {
    width: 80,
    height: 3,
    backgroundColor: COLORS.accent,
    marginBottom: 40,
  },
  coverMetaRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  coverMetaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.textMuted,
    width: 130,
  },
  coverMetaValue: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.textPrimary,
    flex: 1,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 40,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  coverFooterText: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: COLORS.textMuted,
  },

  // ---- Secciones comunes ----
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  sectionNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.accent,
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: COLORS.background,
  },
  sectionBody: {
    marginBottom: 20,
  },

  // ---- Textos generales ----
  paragraph: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.6,
    marginBottom: 6,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },

  // ---- Tablas ----
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COLORS.white,
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray,
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightGray,
  },
  tableCell: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#334155',
    flex: 1,
  },

  // ---- Badges de nivel de riesgo ----
  riskBadge: {
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignSelf: 'flex-start',
  },
  riskBadgeText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: COLORS.white,
  },

  // ---- KPI cards ----
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: 80,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  kpiNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    color: COLORS.white,
  },
  kpiLabel: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: COLORS.white,
    marginTop: 2,
    textAlign: 'center',
  },

  // ---- Subsección ----
  subsectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.background,
    marginBottom: 6,
    marginTop: 10,
  },

  // ---- Bloque de evidencia ----
  evidenceBlock: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  evidenceBlockHeader: {
    backgroundColor: COLORS.surface,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  evidenceBlockHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COLORS.white,
    flex: 1,
  },
  evidenceBlockBody: {
    padding: 8,
  },

  // ---- Recomendaciones ----
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  recommendationBullet: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: COLORS.accent,
    marginRight: 8,
    marginTop: -3,
  },
  recommendationText: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.6,
    flex: 1,
  },

  // ---- Pie de página ----
  pageFooter: {
    position: 'absolute',
    bottom: 30,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray,
    paddingTop: 8,
  },
  pageFooterText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: COLORS.textMuted,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_RISK_LEVELS: RiskLevel[] = [
  'CRÍTICO',
  'ALTO',
  'MEDIO',
  'BAJO',
  'INFORMATIVO',
];

function formatDate(iso: string | null): string {
  if (!iso) return 'No disponible';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function shortId(uuid: string): string {
  return uuid.substring(0, 8).toUpperCase();
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.substring(0, max - 1) + '…';
}

/** Genera texto de recomendaciones basado en los niveles de riesgo detectados */
function buildRecommendations(
  byLevel: Record<RiskLevel, number>,
): Array<{ level: RiskLevel | null; text: string }> {
  const recs: Array<{ level: RiskLevel | null; text: string }> = [];

  if (byLevel['CRÍTICO'] > 0) {
    recs.push({
      level: 'CRÍTICO',
      text:
        `Se detectaron ${byLevel['CRÍTICO']} incidente(s) de nivel CRÍTICO. ` +
        'Se recomienda activar el protocolo de respuesta a incidentes de forma inmediata, ' +
        'aislar los sistemas afectados, revocar credenciales comprometidas y notificar ' +
        'al equipo de seguridad de nivel 3 y a la dirección en un plazo máximo de 1 hora.',
    });
    recs.push({
      level: 'CRÍTICO',
      text:
        'Para los ataques de fuerza bruta detectados: bloquear temporalmente las IPs de ' +
        'origen en el firewall perimetral, implementar límite de intentos de autenticación ' +
        '(account lockout) y revisar las políticas de contraseñas.',
    });
  }

  if (byLevel['ALTO'] > 0) {
    recs.push({
      level: 'ALTO',
      text:
        `Se detectaron ${byLevel['ALTO']} incidente(s) de nivel ALTO. ` +
        'Revisar de forma prioritaria los accesos no autorizados identificados, validar ' +
        'las credenciales de los usuarios involucrados y auditar los permisos de acceso ' +
        'a los recursos afectados. Notificar al responsable de seguridad en menos de 4 horas.',
    });
  }

  if (byLevel['MEDIO'] > 0) {
    recs.push({
      level: 'MEDIO',
      text:
        `Se detectaron ${byLevel['MEDIO']} incidente(s) de nivel MEDIO (intentos fallidos de autenticación). ` +
        'Revisar los intentos fallidos de autenticación acumulados por usuario, verificar ' +
        'si existen patrones de acceso sospechosos y reforzar la formación en seguridad ' +
        'para los usuarios con múltiples fallos.',
    });
  }

  if (byLevel['BAJO'] > 0) {
    recs.push({
      level: 'BAJO',
      text:
        `Se registraron ${byLevel['BAJO']} incidente(s) de nivel BAJO (actividad fuera de horario laboral). ` +
        'Revisar y documentar los accesos fuera del horario habitual. Si no están justificados, ' +
        'considerar la implementación de controles de acceso basados en horario (time-based ACLs).',
    });
  }

  if (byLevel['INFORMATIVO'] > 0) {
    recs.push({
      level: 'INFORMATIVO',
      text:
        `Se registraron ${byLevel['INFORMATIVO']} evento(s) informativos. ` +
        'Estos eventos no requieren acción inmediata, pero se recomienda incluirlos en el ' +
        'seguimiento periódico de actividad del sistema.',
    });
  }

  // Recomendaciones generales siempre presentes
  recs.push({
    level: null,
    text:
      'Mantener actualizados los sistemas de detección de intrusiones (IDS/IPS) y ' +
      'las firmas de amenazas. Revisar y ajustar las reglas de correlación periódicamente.',
  });

  recs.push({
    level: null,
    text:
      'Documentar todos los incidentes en el sistema de gestión de tickets de seguridad ' +
      'y realizar un análisis post-mortem al menos una vez por semana con el equipo SOC.',
  });

  return recs;
}

/** Genera texto de conclusiones basado en estadísticas reales */
function buildConclusions(
  totalRecords: number,
  totalIncidents: number,
  byLevel: Record<RiskLevel, number>,
  topIPs: RankedItem[],
  generatedAt: string,
): string[] {
  const incidentRate =
    totalRecords > 0
      ? ((totalIncidents / totalRecords) * 100).toFixed(2)
      : '0.00';

  const criticalAndHigh = byLevel['CRÍTICO'] + byLevel['ALTO'];
  const hasCritical = byLevel['CRÍTICO'] > 0;

  const lines: string[] = [];

  lines.push(
    `El análisis realizado el ${formatDate(generatedAt)} procesó un total de ` +
    `${totalRecords.toLocaleString('es-ES')} registros, de los cuales ${totalIncidents.toLocaleString('es-ES')} ` +
    `fueron clasificados como incidentes de seguridad (tasa de detección: ${incidentRate} %).`,
  );

  if (totalIncidents === 0) {
    lines.push(
      'No se detectaron incidentes de seguridad en el período analizado. ' +
      'El sistema se encuentra dentro de los parámetros normales de operación.',
    );
  } else {
    if (hasCritical) {
      lines.push(
        `La presencia de ${byLevel['CRÍTICO']} incidente(s) de nivel CRÍTICO requiere ` +
        'atención inmediata por parte del equipo de respuesta a incidentes. ' +
        'Estos eventos representan el mayor riesgo para la infraestructura y deben ser ' +
        'escalados sin demora.',
      );
    }

    if (criticalAndHigh > 0) {
      lines.push(
        `En total, ${criticalAndHigh} incidente(s) presentan un nivel de riesgo CRÍTICO o ALTO, ` +
        'lo que indica la necesidad de revisar y fortalecer los controles de acceso y autenticación ' +
        'de la organización a corto plazo.',
      );
    }

    if (topIPs.length > 0) {
      const topIP = topIPs[0];
      lines.push(
        `La IP de origen con mayor actividad registrada es ${topIP.value} con ${topIP.count} evento(s). ` +
        'Se recomienda investigar en profundidad la actividad de esta dirección IP.',
      );
    }

    lines.push(
      'Este informe ha sido generado automáticamente por SOC Incident Analyzer. ' +
      'Los hallazgos deben ser validados por un analista de seguridad certificado antes de ' +
      'tomar acciones definitivas. Los datos procesados no han abandonado el entorno del navegador.',
    );
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Pie de página de cada página (excepto portada) */
const PageFooter: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.pageFooter} fixed>
    <Text style={styles.pageFooterText}>SOC Incident Analyzer — {title}</Text>
    <Text
      style={styles.pageFooterText}
      render={({ pageNumber, totalPages }) =>
        `Pág. ${pageNumber} / ${totalPages}`
      }
    />
  </View>
);

/** Cabecera de sección numerada */
const SectionHeader: React.FC<{ number: string; title: string }> = ({
  number,
  title,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionNumber}>{number}.</Text>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/** Badge de nivel de riesgo inline */
const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => (
  <View
    style={[
      styles.riskBadge,
      { backgroundColor: RISK_COLORS[level] },
    ]}
  >
    <Text style={styles.riskBadgeText}>{level}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Secciones del documento
// ---------------------------------------------------------------------------

/** Sección 1 — Portada */
const CoverPage: React.FC<{
  session: ActiveSession;
  generatedAt: string;
  totalIncidents: number;
}> = ({ session, generatedAt, totalIncidents }) => (
  <Page size="A4" style={[styles.page, styles.coverPage]}>
    <View style={styles.coverContainer}>
      <View style={styles.coverBadge}>
        <Text style={styles.coverBadgeText}>Informe de Seguridad</Text>
      </View>

      <Text style={styles.coverTitle}>SOC Incident{'\n'}Analyzer</Text>
      <Text style={styles.coverSubtitle}>
        Informe de Análisis de Incidentes de Seguridad
      </Text>

      <View style={styles.coverDivider} />

      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Archivo analizado:</Text>
        <Text style={styles.coverMetaValue}>
          {session.file?.name ?? 'No disponible'}
        </Text>
      </View>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Tamaño del archivo:</Text>
        <Text style={styles.coverMetaValue}>
          {session.file?.formattedSize ?? 'No disponible'}
        </Text>
      </View>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Total de registros:</Text>
        <Text style={styles.coverMetaValue}>
          {session.totalRecords.toLocaleString('es-ES')}
        </Text>
      </View>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Total de incidentes:</Text>
        <Text style={styles.coverMetaValue}>
          {totalIncidents.toLocaleString('es-ES')}
        </Text>
      </View>
      <View style={styles.coverMetaRow}>
        <Text style={styles.coverMetaLabel}>Fecha de generación:</Text>
        <Text style={styles.coverMetaValue}>{formatDate(generatedAt)}</Text>
      </View>
    </View>

    <View style={styles.coverFooter}>
      <Text style={styles.coverFooterText}>
        Generado por SOC Incident Analyzer
      </Text>
      <Text style={styles.coverFooterText}>
        Procesamiento local — ningún dato fue enviado a servidores externos
      </Text>
    </View>
  </Page>
);

/** Sección 2 — Resumen ejecutivo */
const ExecutiveSummarySection: React.FC<{
  incidents: Incident[];
  byLevel: Record<RiskLevel, number>;
}> = ({ incidents, byLevel }) => {
  const hasCritical = byLevel['CRÍTICO'] > 0 || byLevel['ALTO'] > 0;

  return (
    <View style={styles.sectionBody} break>
      <SectionHeader number="2" title="Resumen Ejecutivo" />

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#1E293B' }]}>
          <Text style={styles.kpiNumber}>
            {incidents.length.toLocaleString('es-ES')}
          </Text>
          <Text style={styles.kpiLabel}>Total Incidentes</Text>
        </View>
        {ALL_RISK_LEVELS.map((level) => (
          <View
            key={level}
            style={[
              styles.kpiCard,
              { backgroundColor: RISK_COLORS[level] },
            ]}
          >
            <Text style={styles.kpiNumber}>{byLevel[level]}</Text>
            <Text style={styles.kpiLabel}>{level}</Text>
          </View>
        ))}
      </View>

      {/* Hallazgos destacados */}
      <Text style={styles.subsectionTitle}>Hallazgos Destacados</Text>
      {incidents.length === 0 ? (
        <Text style={styles.paragraph}>
          No se detectaron incidentes de seguridad en el período analizado.
        </Text>
      ) : (
        <>
          <Text style={styles.paragraph}>
            El análisis procesó los registros del archivo cargado y detectó{' '}
            {incidents.length} incidente(s) de seguridad distribuidos en los
            siguientes niveles de riesgo:
          </Text>
          {ALL_RISK_LEVELS.filter((l) => byLevel[l] > 0).map((level) => (
            <Text key={level} style={styles.paragraph}>
              {'  • '}
              <Text style={styles.bold}>{level}:</Text> {byLevel[level]}{' '}
              incidente(s)
            </Text>
          ))}
          {hasCritical && (
            <Text style={[styles.paragraph, { marginTop: 8 }]}>
              ⚠ Se han identificado incidentes de nivel CRÍTICO y/o ALTO que
              requieren atención inmediata. Consulte la sección de
              Recomendaciones para las acciones prioritarias.
            </Text>
          )}
        </>
      )}
    </View>
  );
};

/** Sección 3 — Descripción del archivo */
const FileDescriptionSection: React.FC<{
  session: ActiveSession;
}> = ({ session }) => (
  <View style={styles.sectionBody}>
    <SectionHeader number="3" title="Descripción del Archivo Analizado" />

    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Campo</Text>
        <Text style={styles.tableHeaderCell}>Valor</Text>
      </View>
      {[
        ['Nombre del archivo', session.file?.name ?? 'No disponible'],
        ['Tamaño', session.file?.formattedSize ?? 'No disponible'],
        ['Extensión', session.file?.extension ?? 'No disponible'],
        [
          'Hoja procesada',
          session.file?.sheetName ?? 'N/A (CSV)',
        ],
        [
          'Múltiples hojas',
          session.file?.multipleSheets ? 'Sí (solo se procesó la primera hoja)' : 'No',
        ],
        [
          'Total de registros procesados',
          session.totalRecords.toLocaleString('es-ES'),
        ],
        [
          'Errores de procesamiento',
          session.processingErrors.length.toLocaleString('es-ES'),
        ],
        [
          'Timestamp del análisis',
          formatDate(session.analysisTimestamp),
        ],
      ].map(([label, value], i) => (
        <View
          key={label}
          style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.tableCell, styles.bold, { flex: 0.5 }]}>
            {label}
          </Text>
          <Text style={styles.tableCell}>{value}</Text>
        </View>
      ))}
    </View>
  </View>
);

/** Sección 4 — Metodología */
const MethodologySection: React.FC = () => (
  <View style={styles.sectionBody}>
    <SectionHeader number="4" title="Metodología de Análisis" />

    <Text style={styles.paragraph}>
      SOC Incident Analyzer emplea un motor de detección de reglas estático
      que evalúa cada registro del archivo cargado de forma individual y en
      contexto de lote. Todo el procesamiento se realiza íntegramente en el
      navegador del usuario; ningún dato es transmitido a servicios externos.
    </Text>

    <Text style={styles.subsectionTitle}>Reglas de Detección Implementadas</Text>

    {[
      {
        id: 'AUTH_FAILURE',
        name: 'Intento fallido de autenticación',
        level: 'MEDIO' as RiskLevel,
        desc:
          'Se activa cuando el campo "estado" del registro contiene un valor que ' +
          'indica fallo de autenticación (failed, failure, error, etc.). ' +
          'Campos requeridos: estado.',
      },
      {
        id: 'UNAUTHORIZED_ACCESS',
        name: 'Acceso no autorizado',
        level: 'ALTO' as RiskLevel,
        desc:
          'Se activa cuando el campo "estado" o "descripción" del registro contiene ' +
          'indicios de acceso denegado (unauthorized, forbidden, 401, 403, etc.). ' +
          'Campos requeridos: estado, descripción.',
      },
      {
        id: 'AFTER_HOURS',
        name: 'Actividad fuera de horario laboral',
        level: 'BAJO' as RiskLevel,
        desc:
          'Se activa cuando el timestamp del registro cae fuera del horario laboral ' +
          'configurado (por defecto lunes a viernes, 08:00–18:00). ' +
          'Campos requeridos: timestamp.',
      },
      {
        id: 'BRUTE_FORCE',
        name: 'Ataque de fuerza bruta',
        level: 'CRÍTICO' as RiskLevel,
        desc:
          'Utiliza un algoritmo de ventana deslizante O(n) para detectar 5 o más ' +
          'intentos fallidos de autenticación desde la misma IP de origen dentro ' +
          'de una ventana de 10 minutos. Campos requeridos: IP de origen, estado, timestamp.',
      },
      {
        id: 'CRITICAL_SEVERITY',
        name: 'Evento de severidad crítica',
        level: 'CRÍTICO' as RiskLevel,
        desc:
          'Se activa únicamente cuando el campo "severidad" del registro contiene ' +
          'explícitamente uno de los valores: critical, crítico, crit (comparación ' +
          'case-insensitive). Campos requeridos: severidad.',
      },
    ].map((rule, i) => (
      <View
        key={rule.id}
        style={[
          styles.tableRow,
          { alignItems: 'flex-start', paddingVertical: 8 },
          i % 2 === 1 ? styles.tableRowAlt : {},
        ]}
      >
        <View style={{ flex: 0.4 }}>
          <Text style={[styles.tableCell, styles.bold]}>{rule.name}</Text>
          <RiskBadge level={rule.level} />
        </View>
        <Text style={[styles.tableCell, { flex: 0.6 }]}>{rule.desc}</Text>
      </View>
    ))}

    <Text style={[styles.paragraph, { marginTop: 10 }]}>
      El nivel de riesgo de cada incidente se determina como el máximo entre
      todos los niveles de las reglas que se dispararon para ese registro,
      siguiendo el orden: CRÍTICO {'>'} ALTO {'>'} MEDIO {'>'} BAJO {'>'}{' '}
      INFORMATIVO.
    </Text>
  </View>
);

/** Sección 5 — Estadísticas generales */
const GeneralStatsSection: React.FC<{
  session: ActiveSession;
  byLevel: Record<RiskLevel, number>;
  topEventTypes: RankedItem[];
}> = ({ session, byLevel, topEventTypes }) => {
  const total = Object.values(byLevel).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.sectionBody}>
      <SectionHeader number="5" title="Estadísticas Generales" />

      {/* Tabla de distribución por nivel */}
      <Text style={styles.subsectionTitle}>
        Distribución por Nivel de Riesgo
      </Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Nivel de Riesgo</Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>Incidentes</Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>Porcentaje</Text>
        </View>
        {ALL_RISK_LEVELS.map((level, i) => {
          const count = byLevel[level];
          const pct = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
          return (
            <View
              key={level}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <View style={[styles.tableCell]}>
                <RiskBadge level={level} />
              </View>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.5, textAlign: 'right' },
                ]}
              >
                {count.toLocaleString('es-ES')}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.5, textAlign: 'right' },
                ]}
              >
                {pct} %
              </Text>
            </View>
          );
        })}
        <View
          style={[
            styles.tableRow,
            {
              backgroundColor: '#F0F4F8',
              borderTopWidth: 2,
              borderTopColor: COLORS.border,
            },
          ]}
        >
          <Text style={[styles.tableCell, styles.bold]}>TOTAL</Text>
          <Text
            style={[
              styles.tableCell,
              styles.bold,
              { flex: 0.5, textAlign: 'right' },
            ]}
          >
            {total.toLocaleString('es-ES')}
          </Text>
          <Text
            style={[
              styles.tableCell,
              styles.bold,
              { flex: 0.5, textAlign: 'right' },
            ]}
          >
            100.00 %
          </Text>
        </View>
      </View>

      {/* Resumen general */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Métrica</Text>
          <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Valor</Text>
        </View>
        {[
          ['Total de registros procesados', session.totalRecords.toLocaleString('es-ES')],
          ['Total de incidentes detectados', total.toLocaleString('es-ES')],
          [
            'Tasa de detección',
            session.totalRecords > 0
              ? `${((total / session.totalRecords) * 100).toFixed(2)} %`
              : '0.00 %',
          ],
          ['Errores de procesamiento', session.processingErrors.length.toLocaleString('es-ES')],
        ].map(([label, value], i) => (
          <View
            key={label}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.tableCell}>{label}</Text>
            <Text style={[styles.tableCell, { textAlign: 'right' }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Top tipos de evento */}
      {topEventTypes.length > 0 && (
        <>
          <Text style={styles.subsectionTitle}>
            Top Tipos de Evento Detectados
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 0.1 }]}>#</Text>
              <Text style={styles.tableHeaderCell}>Tipo de Evento</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.3, textAlign: 'right' }]}>
                Ocurrencias
              </Text>
            </View>
            {topEventTypes.slice(0, 10).map((item, i) => (
              <View
                key={item.value}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, { flex: 0.1 }]}>{i + 1}</Text>
                <Text style={styles.tableCell}>{item.value}</Text>
                <Text
                  style={[
                    styles.tableCell,
                    { flex: 0.3, textAlign: 'right' },
                  ]}
                >
                  {item.count.toLocaleString('es-ES')}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

/** Sección 6 — Listado de incidentes */
const IncidentListSection: React.FC<{
  incidents: Incident[];
}> = ({ incidents }) => (
  <View style={styles.sectionBody} break>
    <SectionHeader number="6" title="Listado de Incidentes" />

    {incidents.length === 0 ? (
      <Text style={styles.paragraph}>
        No se detectaron incidentes en el análisis.
      </Text>
    ) : (
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 0.25 }]}>ID</Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.3 }]}>Nivel</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Motivo</Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.45 }]}>
            Primer Registro
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.2, textAlign: 'right' }]}>
            Evidencias
          </Text>
        </View>
        {incidents.map((incident, i) => (
          <View
            key={incident.id}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.tableCell, styles.bold, { flex: 0.25 }]}>
              #{shortId(incident.id)}
            </Text>
            <View style={{ flex: 0.3 }}>
              <RiskBadge level={incident.riskLevel} />
            </View>
            <Text style={[styles.tableCell, { flex: 1 }]}>
              {truncate(incident.reason, 60)}
            </Text>
            <Text style={[styles.tableCell, { flex: 0.45 }]}>
              {formatDate(incident.firstTimestamp)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { flex: 0.2, textAlign: 'right' },
              ]}
            >
              {incident.evidenceRecords.length}
            </Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

/** Sección 7 — Evidencias */
const EvidenceSection: React.FC<{
  incidents: Incident[];
}> = ({ incidents }) => (
  <View style={styles.sectionBody} break>
    <SectionHeader number="7" title="Evidencias y Registros de Respaldo" />

    <Text style={styles.paragraph}>
      Se muestran hasta 3 registros de respaldo por incidente para mantener
      el tamaño del informe dentro de límites razonables.
    </Text>

    {incidents.length === 0 ? (
      <Text style={styles.paragraph}>No hay evidencias que mostrar.</Text>
    ) : (
      incidents.map((incident) => {
        const evidenceToShow = incident.evidenceRecords.slice(0, 3);
        const fieldKeys = Array.from(
          new Set(
            evidenceToShow.flatMap((r) => Object.keys(r.fields)),
          ),
        ).slice(0, 6); // Máximo 6 columnas para que quepan en la página

        return (
          <View key={incident.id} style={styles.evidenceBlock}>
            {/* Cabecera del bloque */}
            <View style={styles.evidenceBlockHeader}>
              <Text style={styles.evidenceBlockHeaderText}>
                Incidente #{shortId(incident.id)} —{' '}
                {incident.reason}
              </Text>
              <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[incident.riskLevel] }]}>
                <Text style={styles.riskBadgeText}>{incident.riskLevel}</Text>
              </View>
            </View>

            {/* Tabla de evidencias */}
            <View style={styles.evidenceBlockBody}>
              {fieldKeys.length > 0 ? (
                <View style={styles.table}>
                  <View style={[styles.tableHeader, { backgroundColor: COLORS.surface }]}>
                    {fieldKeys.map((key) => (
                      <Text key={key} style={styles.tableHeaderCell}>
                        {key}
                      </Text>
                    ))}
                  </View>
                  {evidenceToShow.map((record, ri) => (
                    <View
                      key={record._rowIndex}
                      style={[
                        styles.tableRow,
                        ri % 2 === 1 ? styles.tableRowAlt : {},
                      ]}
                    >
                      {fieldKeys.map((key) => {
                        const f = record.fields[key as keyof typeof record.fields];
                        const val = f
                          ? String(f.normalized ?? f.raw ?? '')
                          : '';
                        return (
                          <Text key={key} style={styles.tableCell}>
                            {truncate(val, 30)}
                          </Text>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.paragraph}>
                  No hay campos normalizados disponibles para este incidente.
                </Text>
              )}
              {incident.evidenceRecords.length > 3 && (
                <Text style={[styles.paragraph, { color: COLORS.textMuted, marginTop: 4 }]}>
                  … y {incident.evidenceRecords.length - 3} registro(s) adicional(es) no mostrado(s).
                </Text>
              )}
            </View>
          </View>
        );
      })
    )}
  </View>
);

/** Sección 8 — IPs y usuarios */
const IPsAndUsersSection: React.FC<{
  topIPs: RankedItem[];
  incidents: Incident[];
}> = ({ topIPs, incidents }) => {
  // Recopilar usuarios únicos a partir de los registros de evidencia
  const userCounts = new Map<string, number>();
  for (const incident of incidents) {
    for (const record of incident.evidenceRecords) {
      const userField = record.fields['user'];
      if (userField && userField.status !== 'absent') {
        const val = String(userField.normalized ?? userField.raw).trim();
        if (val) {
          userCounts.set(val, (userCounts.get(val) ?? 0) + 1);
        }
      }
    }
  }

  const topUsers = Array.from(userCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <View style={styles.sectionBody} break>
      <SectionHeader number="8" title="IPs y Usuarios Involucrados" />

      {/* Top IPs */}
      <Text style={styles.subsectionTitle}>Top IPs de Origen</Text>
      {topIPs.length === 0 ? (
        <Text style={styles.paragraph}>
          No se detectaron IPs de origen en los registros analizados.
        </Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.1 }]}>#</Text>
            <Text style={styles.tableHeaderCell}>IP de Origen</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'right' }]}>
              Ocurrencias
            </Text>
          </View>
          {topIPs.slice(0, 10).map((item, i) => (
            <View
              key={item.value}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, { flex: 0.1 }]}>{i + 1}</Text>
              <Text style={styles.tableCell}>{item.value}</Text>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.4, textAlign: 'right' },
                ]}
              >
                {item.count.toLocaleString('es-ES')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Usuarios */}
      <Text style={styles.subsectionTitle}>Usuarios Identificados</Text>
      {topUsers.length === 0 ? (
        <Text style={styles.paragraph}>
          No se detectaron usuarios en los registros de incidentes analizados.
        </Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.1 }]}>#</Text>
            <Text style={styles.tableHeaderCell}>Usuario</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'right' }]}>
              Incidentes
            </Text>
          </View>
          {topUsers.map((item, i) => (
            <View
              key={item.value}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, { flex: 0.1 }]}>{i + 1}</Text>
              <Text style={styles.tableCell}>{item.value}</Text>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 0.4, textAlign: 'right' },
                ]}
              >
                {item.count.toLocaleString('es-ES')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/** Sección 9 — Recomendaciones */
const RecommendationsSection: React.FC<{
  byLevel: Record<RiskLevel, number>;
}> = ({ byLevel }) => {
  const recs = buildRecommendations(byLevel);

  return (
    <View style={styles.sectionBody} break>
      <SectionHeader number="9" title="Recomendaciones de Mitigación" />
      <Text style={styles.paragraph}>
        Las siguientes recomendaciones se han generado automáticamente a partir
        de los incidentes detectados en este análisis. Deben ser evaluadas y
        priorizadas por el equipo de seguridad responsable.
      </Text>
      {recs.map((rec, i) => (
        <View key={i} style={styles.recommendationItem}>
          <Text style={styles.recommendationBullet}>›</Text>
          <View style={{ flex: 1 }}>
            {rec.level && (
              <View style={{ marginBottom: 3 }}>
                <RiskBadge level={rec.level} />
              </View>
            )}
            <Text style={styles.recommendationText}>{rec.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

/** Sección 10 — Conclusiones */
const ConclusionsSection: React.FC<{
  session: ActiveSession;
  totalIncidents: number;
  byLevel: Record<RiskLevel, number>;
  topIPs: RankedItem[];
  generatedAt: string;
}> = ({ session, totalIncidents, byLevel, topIPs, generatedAt }) => {
  const conclusions = buildConclusions(
    session.totalRecords,
    totalIncidents,
    byLevel,
    topIPs,
    generatedAt,
  );

  return (
    <View style={styles.sectionBody} break>
      <SectionHeader number="10" title="Conclusiones" />
      {conclusions.map((text, i) => (
        <Text key={i} style={styles.paragraph}>
          {text}
        </Text>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Componente principal: ReportDocument
// ---------------------------------------------------------------------------

export const ReportDocument: React.FC<ReportDocumentProps> = ({
  session,
  incidents,
  stats,
  generatedAt,
}) => {
  const { byLevel, topIPs, topEventTypes } = stats;

  return (
    <Document
      title="SOC Incident Analyzer — Informe de Seguridad"
      author="SOC Incident Analyzer"
      subject="Análisis de Incidentes de Seguridad"
      creator="SOC Insight v0.1.0"
      producer="@react-pdf/renderer"
    >
      {/* Página 1: Portada */}
      <CoverPage
        session={session}
        generatedAt={generatedAt}
        totalIncidents={incidents.length}
      />

      {/* Páginas de contenido */}
      <Page size="A4" style={styles.page}>
        <PageFooter title="Informe de Seguridad" />

        {/* Sección 2: Resumen ejecutivo */}
        <ExecutiveSummarySection incidents={incidents} byLevel={byLevel} />

        {/* Sección 3: Descripción del archivo */}
        <FileDescriptionSection session={session} />

        {/* Sección 4: Metodología */}
        <MethodologySection />

        {/* Sección 5: Estadísticas generales */}
        <GeneralStatsSection
          session={session}
          byLevel={byLevel}
          topEventTypes={topEventTypes}
        />

        {/* Sección 6: Listado de incidentes */}
        <IncidentListSection incidents={incidents} />

        {/* Sección 7: Evidencias */}
        <EvidenceSection incidents={incidents} />

        {/* Sección 8: IPs y usuarios */}
        <IPsAndUsersSection topIPs={topIPs} incidents={incidents} />

        {/* Sección 9: Recomendaciones */}
        <RecommendationsSection byLevel={byLevel} />

        {/* Sección 10: Conclusiones */}
        <ConclusionsSection
          session={session}
          totalIncidents={incidents.length}
          byLevel={byLevel}
          topIPs={topIPs}
          generatedAt={generatedAt}
        />
      </Page>
    </Document>
  );
};

export default ReportDocument;
