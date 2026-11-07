/**
 * pdfGenerator — SOC Incident Analyzer
 * Usa jsPDF + jspdf-autotable para generar el informe PDF directamente en el navegador.
 * No depende de @react-pdf/renderer ni de APIs de Node.js.
 */

import type { ActiveSession, Incident, AppError } from '../../types';
import { calcIncidentsByRiskLevel, calcTopIPs, calcTopEventTypes } from '../stats';

// Colores del tema
const C = {
  bg:        [15,  23,  42],   // #0F172A
  surface:   [30,  41,  59],   // #1E293B
  border:    [51,  65,  85],   // #334155
  text:      [241, 245, 249],  // #F1F5F9
  muted:     [148, 163, 184],  // #94A3B8
  accent:    [59,  130, 246],  // #3B82F6
  white:     [255, 255, 255],
  critico:   [185, 28,  28 ],  // #B91C1C
  alto:      [194, 65,  12 ],  // #C2410C
  medio:     [180, 83,  9  ],  // #B45309
  bajo:      [21,  128, 61 ],  // #15803D
  info:      [29,  78,  216],  // #1D4ED8
} as const;

type RGB = readonly [number, number, number];

function riskColor(level: string): RGB {
  switch (level) {
    case 'CRÍTICO':     return C.critico;
    case 'ALTO':        return C.alto;
    case 'MEDIO':       return C.medio;
    case 'BAJO':        return C.bajo;
    default:            return C.info;
  }
}

function fmt(iso: string | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export async function generatePDF(
  session: ActiveSession,
  incidents: Incident[],
): Promise<Blob> {
  try {
    const byLevel = calcIncidentsByRiskLevel(incidents);
    const topIPs  = calcTopIPs(session.records, 10);
    const topEventTypes = calcTopEventTypes(session.records, 10);
    const generatedAt = new Date().toISOString();

    // Import dinámico — jsPDF funciona sin problemas en el navegador
    const { jsPDF } = await import('jspdf');
    const autoTableMod = await import('jspdf-autotable');
    // jspdf-autotable se registra como plugin en el prototipo de jsPDF
    void autoTableMod;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    let y = 0;

    // ── Helpers ────────────────────────────────────────────────────────────

    function newPage() {
      doc.addPage();
      y = 20;
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text('SOC Incident Analyzer — Informe Confidencial', 14, H - 8);
      doc.text(`Pág. ${doc.getNumberOfPages()}`, W - 14, H - 8, { align: 'right' });
    }

    function checkY(needed: number) {
      if (y + needed > H - 20) newPage();
    }

    function sectionTitle(num: string, title: string) {
      checkY(14);
      doc.setFillColor(...C.surface as RGB);
      doc.rect(0, y - 1, W, 10, 'F');
      doc.setDrawColor(...C.accent as RGB);
      doc.setLineWidth(0.8);
      doc.line(0, y - 1, 0, y + 9);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.accent as RGB);
      doc.text(num + '.', 14, y + 6);
      doc.setTextColor(...C.text as RGB);
      doc.text(title, 22, y + 6);
      y += 14;
    }

    function para(text: string, indent = 14) {
      checkY(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted as RGB);
      const lines = doc.splitTextToSize(text, W - indent - 14);
      doc.text(lines, indent, y);
      y += lines.length * 5 + 3;
    }

    function autoTable(head: string[][], body: (string | number)[][], opts?: Record<string, unknown>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).autoTable({
        startY: y,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: C.surface, textColor: C.text, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
        ...opts,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // ── Portada ─────────────────────────────────────────────────────────────

    doc.setFillColor(...C.bg as RGB);
    doc.rect(0, 0, W, H, 'F');

    doc.setFillColor(...C.accent as RGB);
    doc.rect(0, 0, W, 3, 'F');

    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text as RGB);
    doc.text('SOC Incident', W / 2, 80, { align: 'center' });
    doc.text('Analyzer', W / 2, 95, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted as RGB);
    doc.text('Informe de Análisis de Incidentes de Seguridad', W / 2, 112, { align: 'center' });

    doc.setDrawColor(...C.accent as RGB);
    doc.setLineWidth(0.5);
    doc.line(W / 2 - 30, 118, W / 2 + 30, 118);

    const meta = [
      ['Archivo analizado:', session.file?.name ?? 'N/A'],
      ['Tamaño:', session.file?.formattedSize ?? 'N/A'],
      ['Total de registros:', String(session.totalRecords)],
      ['Total de incidentes:', String(incidents.length)],
      ['Fecha de generación:', fmt(generatedAt)],
    ];
    doc.setFontSize(9);
    let my = 130;
    for (const [label, val] of meta) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.muted as RGB);
      doc.text(label, W / 2 - 40, my, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text as RGB);
      doc.text(val, W / 2 - 36, my);
      my += 9;
    }

    doc.setFontSize(7);
    doc.setTextColor(...C.muted as RGB);
    doc.text('Procesamiento local — ningún dato fue enviado a servidores externos', W / 2, H - 12, { align: 'center' });

    // ── Página 2+ ───────────────────────────────────────────────────────────
    newPage();

    // ── 2. Resumen ejecutivo ────────────────────────────────────────────────
    sectionTitle('2', 'Resumen Ejecutivo');

    const levels: Array<'CRÍTICO'|'ALTO'|'MEDIO'|'BAJO'|'INFORMATIVO'> =
      ['CRÍTICO', 'ALTO', 'MEDIO', 'BAJO', 'INFORMATIVO'];

    // KPI mini-cards
    const cardW = (W - 28 - 4 * 3) / 5;
    let cx = 14;
    for (const lv of levels) {
      const col = riskColor(lv);
      doc.setFillColor(...col as RGB);
      doc.roundedRect(cx, y, cardW, 16, 2, 2, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white as RGB);
      doc.text(String(byLevel[lv]), cx + cardW / 2, y + 9, { align: 'center' });
      doc.setFontSize(6);
      doc.text(lv, cx + cardW / 2, y + 14, { align: 'center' });
      cx += cardW + 3;
    }
    y += 22;

    if (incidents.length === 0) {
      para('No se detectaron incidentes de seguridad en el período analizado.');
    } else {
      para(`Se analizaron ${session.totalRecords.toLocaleString('es-ES')} registros y se detectaron ${incidents.length} incidentes. ` +
        levels.filter(l => byLevel[l] > 0).map(l => `${byLevel[l]} ${l}`).join(', ') + '.');
      if (byLevel['CRÍTICO'] > 0 || byLevel['ALTO'] > 0) {
        checkY(8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.critico as RGB);
        doc.text('⚠ Se han identificado incidentes de nivel CRÍTICO y/o ALTO que requieren atención inmediata.', 14, y);
        y += 8;
      }
    }

    // ── 3. Descripción del archivo ──────────────────────────────────────────
    checkY(20);
    sectionTitle('3', 'Descripción del Archivo Analizado');
    autoTable(
      [['Campo', 'Valor']],
      [
        ['Nombre del archivo', session.file?.name ?? 'N/A'],
        ['Tamaño', session.file?.formattedSize ?? 'N/A'],
        ['Extensión', session.file?.extension ?? 'N/A'],
        ['Hoja procesada', session.file?.sheetName ?? 'N/A (CSV)'],
        ['Múltiples hojas', session.file?.multipleSheets ? 'Sí' : 'No'],
        ['Total de registros', session.totalRecords.toLocaleString('es-ES')],
        ['Errores de procesamiento', String(session.processingErrors.length)],
        ['Timestamp del análisis', fmt(session.analysisTimestamp)],
      ]
    );

    // ── 4. Metodología ──────────────────────────────────────────────────────
    checkY(20);
    sectionTitle('4', 'Metodología de Análisis');
    para('El motor de detección aplica 5 reglas sobre cada registro del archivo. Todo el procesamiento ocurre en el navegador; ningún dato se transmite a servidores externos.');
    autoTable(
      [['Regla', 'Severidad', 'Descripción']],
      [
        ['Intento fallido de autenticación', 'MEDIO', 'Detecta fallos de autenticación en el campo estado.'],
        ['Acceso no autorizado', 'ALTO', 'Detecta accesos denegados en estado o descripción.'],
        ['Actividad fuera de horario', 'BAJO', 'Detecta eventos fuera del horario laboral (L-V 08-18h).'],
        ['Ataque de fuerza bruta', 'CRÍTICO', '5+ fallos de la misma IP en ventana de 10 minutos.'],
        ['Evento de severidad crítica', 'CRÍTICO', 'Campo severidad = "critical", "crítico" o "crit".'],
      ]
    );

    // ── 5. Dashboard Ejecutivo — Estadísticas Generales ────────────────────
    newPage();
    sectionTitle('5', 'Dashboard Ejecutivo de Incidentes');

    // ── Banner de alerta crítica ──────────────────────────────────────────
    if (byLevel['CRÍTICO'] > 0) {
      checkY(14);
      doc.setFillColor(254, 226, 226);
      doc.rect(14, y - 1, W - 28, 11, 'F');
      doc.setDrawColor(...C.critico as RGB);
      doc.setLineWidth(0.5);
      doc.rect(14, y - 1, W - 28, 11, 'S');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.critico as RGB);
      doc.text(`⚠  ALTA AMENAZA DETECTADA: Se han identificado ${byLevel['CRÍTICO']} incidente(s) crítico(s). Se requiere contención inmediata.`, 18, y + 6);
      y += 16;
    } else if (byLevel['ALTO'] > 0) {
      checkY(14);
      doc.setFillColor(255, 237, 213);
      doc.rect(14, y - 1, W - 28, 11, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.alto as RGB);
      doc.text(`⚠  ATENCIÓN: Se detectaron ${byLevel['ALTO']} incidente(s) de nivel ALTO. Revisión prioritaria recomendada.`, 18, y + 6);
      y += 16;
    }

    // ── KPI Cards ─────────────────────────────────────────────────────────
    const total = incidents.length;
    checkY(22);
    const kpiItems = [
      { label: 'Registros Analizados', value: String(session.totalRecords), color: C.surface as RGB },
      { label: 'Incidentes Críticos', value: String(byLevel['CRÍTICO']), color: C.critico as RGB },
      { label: 'Incidentes Altos', value: String(byLevel['ALTO']), color: C.alto as RGB },
      { label: 'Incidentes Medios', value: String(byLevel['MEDIO']), color: C.medio as RGB },
    ];
    const kW = (W - 28 - 9) / 4;
    let kx = 14;
    for (const kpi of kpiItems) {
      doc.setFillColor(...kpi.color);
      doc.roundedRect(kx, y, kW, 18, 2, 2, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.white as RGB);
      doc.text(kpi.label.toUpperCase(), kx + kW / 2, y + 5, { align: 'center' });
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, kx + kW / 2, y + 14, { align: 'center' });
      kx += kW + 3;
    }
    y += 24;

    // ── Descripción ejecutiva ─────────────────────────────────────────────
    checkY(16);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const execDesc = `Durante el período analizado se procesaron ${session.totalRecords.toLocaleString('es-ES')} registros de eventos de seguridad. ` +
      `El sistema identificó ${total} situaciones que requieren atención, de las cuales ` +
      `${byLevel['CRÍTICO']} son de nivel CRÍTICO (acción inmediata), ` +
      `${byLevel['ALTO']} de nivel ALTO (atención prioritaria), ` +
      `${byLevel['MEDIO']} de nivel MEDIO (revisión programada) y ` +
      `${byLevel['BAJO']} de nivel BAJO (monitoreo continuo).`;
    const execLines = doc.splitTextToSize(execDesc, W - 28);
    doc.text(execLines, 14, y);
    y += execLines.length * 4.5 + 6;

    // ── Gráficos: Torta + Barras horizontales ─────────────────────────────
    checkY(90);

    const halfW = (W - 32) / 2;
    const activeLevels = levels.filter(l => byLevel[l] > 0);

    // Titles
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Distribucion por Criticidad (Casos y %)', 14, y);
    doc.text('Incidentes por Nivel de Riesgo', 14 + halfW + 4, y);
    y += 8;

    // ── PIE CHART (left half) ──────────────────────────────────────────────
    const pieR   = 28;
    const pieCX  = 14 + halfW / 2;
    const pieCY  = y + pieR + 4;
    const chartBottomY = pieCY + pieR + 16; // fixed bottom for both columns

    if (activeLevels.length > 0 && total > 0) {
      let ang = -Math.PI / 2;
      for (const lv of activeLevels) {
        const slice = (byLevel[lv] / total) * 2 * Math.PI;
        const mid   = ang + slice / 2;
        const col   = riskColor(lv);

        // Draw sector using triangle fan
        const segSteps = Math.max(3, Math.round(slice * 12));
        for (let s = 0; s < segSteps; s++) {
          const a1 = ang + (slice * s)       / segSteps;
          const a2 = ang + (slice * (s + 1)) / segSteps;
          const x1 = pieCX + Math.cos(a1) * pieR;
          const y1 = pieCY + Math.sin(a1) * pieR;
          const x2 = pieCX + Math.cos(a2) * pieR;
          const y2 = pieCY + Math.sin(a2) * pieR;
          doc.setFillColor(...col as RGB);
          doc.setDrawColor(...col as RGB);
          doc.setLineWidth(0.1);
          // jsPDF triangle via lines closed
          const triPts: Array<[number, number]> = [[x1 - pieCX, y1 - pieCY], [x2 - x1, y2 - y1], [pieCX - x2, pieCY - y2]];
          (doc as any).lines(triPts, pieCX, pieCY, [1, 1], 'F', true);
        }

        // White separator line
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.6);
        doc.line(pieCX, pieCY, pieCX + Math.cos(ang) * pieR, pieCY + Math.sin(ang) * pieR);

        // External label — positioned outside the pie
        const pct   = ((byLevel[lv] / total) * 100).toFixed(1);
        const lR    = pieR + 14;
        const lx    = pieCX + Math.cos(mid) * lR;
        const ly    = pieCY + Math.sin(mid) * lR;
        const align = lx > pieCX ? 'left' : 'right';
        const shortLv = lv === 'INFORMATIVO' ? 'INFO' : lv;
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...col as RGB);
        doc.text(shortLv, lx, ly - 1.5, { align });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(`${byLevel[lv]} (${pct}%)`, lx, ly + 3.5, { align });

        ang += slice;
      }

      // Final white separator
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.6);
      doc.line(pieCX, pieCY, pieCX + Math.cos(-Math.PI / 2) * pieR, pieCY + Math.sin(-Math.PI / 2) * pieR);

      // Legend below pie
      const legStartX = 14;
      const legStartY = chartBottomY - 2;
      let lx2 = legStartX;
      for (const lv of activeLevels) {
        const col = riskColor(lv);
        doc.setFillColor(...col as RGB);
        doc.rect(lx2, legStartY - 3, 4, 4, 'F');
        doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const shortLv = lv === 'INFORMATIVO' ? 'INFO' : lv;
        doc.text(`${shortLv}: ${byLevel[lv]}`, lx2 + 5.5, legStartY);
        lx2 += halfW / activeLevels.length;
      }
    }

    // ── HORIZONTAL BAR CHART (right half) ─────────────────────────────────
    const barX0    = 14 + halfW + 4;
    const barAreaW = halfW - 6;
    const labelW   = 28;
    const valueW   = 26;
    const barMaxW  = barAreaW - labelW - valueW;
    const maxBarV  = Math.max(...activeLevels.map(l => byLevel[l]), 1);
    const rowH     = 12;
    let barRowY    = y + 4;

    for (const lv of activeLevels) {
      const cnt = byLevel[lv];
      const pct = ((cnt / total) * 100).toFixed(1);
      const bw  = Math.max((cnt / maxBarV) * barMaxW, 1);
      const col = riskColor(lv);

      // Level label (left column)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...col as RGB);
      doc.text(lv === 'INFORMATIVO' ? 'INFO' : lv, barX0 + labelW - 2, barRowY + 5.5, { align: 'right' });

      // Background track
      doc.setFillColor(235, 238, 242);
      doc.roundedRect(barX0 + labelW, barRowY, barMaxW, 8, 1, 1, 'F');

      // Colored bar
      doc.setFillColor(...col as RGB);
      doc.roundedRect(barX0 + labelW, barRowY, bw, 8, 1, 1, 'F');

      // Value + % label (right column)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`${cnt}  (${pct}%)`, barX0 + labelW + barMaxW + valueW, barRowY + 5.5, { align: 'right' });

      barRowY += rowH;
    }

    y = chartBottomY + 8;


    // ── Interpretación no técnica ─────────────────────────────────────────
    checkY(30);
    doc.setFillColor(239, 246, 255);
    doc.rect(14, y - 1, W - 28, 26, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    doc.rect(14, y - 1, W - 28, 26, 'S');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('¿Qué significa esto?', 18, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    const meanings: string[] = [];
    if (byLevel['CRÍTICO'] > 0) meanings.push(`CRÍTICO (${byLevel['CRÍTICO']}): Amenaza activa confirmada. Respuesta inmediata (< 1 hora).`);
    if (byLevel['ALTO'] > 0)    meanings.push(`ALTO (${byLevel['ALTO']}): Actividad sospechosa de alto riesgo. Revisar en 4 horas.`);
    if (byLevel['MEDIO'] > 0)   meanings.push(`MEDIO (${byLevel['MEDIO']}): Comportamiento anómalo. Programar revisión en 24 horas.`);
    if (byLevel['BAJO'] > 0)    meanings.push(`BAJO (${byLevel['BAJO']}): Actividad fuera de horario. Monitorear.`);
    doc.setFontSize(7.5);
    meanings.slice(0, 4).forEach((m, i) => { doc.text('• ' + m, 18, y + 12 + i * 5); });
    y += 32;

    // ── Tabla resumen cuantitativo ────────────────────────────────────────
    checkY(20);
    autoTable(
      [['Nivel de Riesgo', 'Descripción para el cliente', 'Incidentes', 'Porcentaje']],
      [
        ['CRÍTICO', 'Acción inmediata requerida', String(byLevel['CRÍTICO']), total > 0 ? ((byLevel['CRÍTICO']/total)*100).toFixed(1)+'%' : '0%'],
        ['ALTO', 'Revisión prioritaria (< 4 h)', String(byLevel['ALTO']), total > 0 ? ((byLevel['ALTO']/total)*100).toFixed(1)+'%' : '0%'],
        ['MEDIO', 'Revisar en 24 horas', String(byLevel['MEDIO']), total > 0 ? ((byLevel['MEDIO']/total)*100).toFixed(1)+'%' : '0%'],
        ['BAJO', 'Monitorear y documentar', String(byLevel['BAJO']), total > 0 ? ((byLevel['BAJO']/total)*100).toFixed(1)+'%' : '0%'],
        ['INFORMATIVO', 'Sin acción requerida', String(byLevel['INFORMATIVO']), total > 0 ? ((byLevel['INFORMATIVO']/total)*100).toFixed(1)+'%' : '0%'],
      ],
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 0) {
            const lvl = data.row.raw[0] as string;
            data.cell.styles.fillColor = riskColor(lvl) as unknown as RGB;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      }
    );

    if (topEventTypes.length > 0) {
      checkY(12);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Tipos de evento más frecuentes', 14, y); y += 3;
      autoTable(
        [['#', 'Tipo de Evento', 'Ocurrencias', 'Qué significa']],
        topEventTypes.slice(0, 6).map((t, i) => {
          const meaning: Record<string, string> = {
            '4625': 'Intento de inicio de sesión fallido',
            '4624': 'Inicio de sesión exitoso',
            '4634': 'Cierre de sesión',
            '4688': 'Nuevo proceso creado',
            '5140': 'Acceso a recurso compartido de red',
            '5156': 'Conexión de red permitida',
            '4663': 'Acceso a objeto del sistema',
            '7036': 'Cambio de estado de servicio',
            'PROXY_ACCESS': 'Tráfico web saliente',
            'HTTP_ACCESS': 'Solicitud HTTP al servidor web',
          };
          return [String(i + 1), t.value, String(t.count), meaning[t.value] ?? 'Evento del sistema'];
        }),
        { columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 22 }, 3: { cellWidth: 110 } } }
      );
    }

    // ── 6. Listado de incidentes ────────────────────────────────────────────
    newPage();
    sectionTitle('6', 'Listado de Incidentes');
    if (incidents.length === 0) {
      para('No se detectaron incidentes.');
    } else {
      autoTable(
        [['ID', 'Nivel', 'Motivo', 'Fecha', 'Evidencias']],
        incidents.map(inc => [
          inc.id.substring(0, 8).toUpperCase(),
          inc.riskLevel,
          inc.reason.length > 60 ? inc.reason.substring(0, 57) + '...' : inc.reason,
          fmt(inc.firstTimestamp),
          String(inc.evidenceRecords.length),
        ]),
        {
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 22 },
            2: { cellWidth: 80 },
            3: { cellWidth: 35 },
            4: { cellWidth: 18 },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
              const lvl = data.row.raw[1] as string;
              data.cell.styles.fillColor = riskColor(lvl) as unknown as RGB;
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        }
      );
    }

    // ── 7. Evidencias ───────────────────────────────────────────────────────
    if (incidents.length > 0) {
      newPage();
      sectionTitle('7', 'Evidencias y Registros de Respaldo');
      const sample = incidents.slice(0, 20);
      for (const inc of sample) {
        checkY(16);
        const col = riskColor(inc.riskLevel);
        doc.setFillColor(...col as RGB);
        doc.rect(14, y - 1, W - 28, 8, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white as RGB);
        doc.text(`#${inc.id.substring(0,8).toUpperCase()} — ${inc.riskLevel} — ${inc.reason.substring(0, 70)}`, 16, y + 4);
        y += 10;

        const evRows = inc.evidenceRecords.slice(0, 3);
        for (const rec of evRows) {
          const fields = Object.entries(rec.fields)
            .filter(([, v]) => v && v.status !== 'absent')
            .map(([k, v]) => `${k}: ${String(v!.normalized ?? v!.raw).substring(0, 40)}`);
          if (fields.length > 0) {
            para('  • ' + fields.join(' | '), 16);
          }
        }
        y += 2;
      }
      if (incidents.length > 20) {
        para(`... y ${incidents.length - 20} incidentes adicionales (ver lista completa en la sección 6).`);
      }
    }

    // ── 8. IPs y usuarios ───────────────────────────────────────────────────
    checkY(20);
    sectionTitle('8', 'IPs y Usuarios Involucrados');
    if (topIPs.length > 0) {
      autoTable(
        [['#', 'IP de Origen', 'Registros']],
        topIPs.map((ip, i) => [String(i + 1), ip.value, String(ip.count)])
      );
    } else {
      para('No se detectaron IPs de origen en los registros.');
    }

    // ── 9. Recomendaciones ──────────────────────────────────────────────────
    checkY(20);
    sectionTitle('9', 'Recomendaciones de Mitigación');
    const recs: string[] = [];
    if (byLevel['CRÍTICO'] > 0) recs.push(
      `${byLevel['CRÍTICO']} incidente(s) CRÍTICO: Activar protocolo de respuesta inmediata, aislar sistemas afectados y revocar credenciales comprometidas en menos de 1 hora.`
    );
    if (byLevel['ALTO'] > 0) recs.push(
      `${byLevel['ALTO']} incidente(s) ALTO: Revisar accesos no autorizados, validar credenciales y auditar permisos. Notificar al responsable en menos de 4 horas.`
    );
    if (byLevel['MEDIO'] > 0) recs.push(
      `${byLevel['MEDIO']} incidente(s) MEDIO: Revisar intentos fallidos por usuario y reforzar formación en seguridad.`
    );
    if (byLevel['BAJO'] > 0) recs.push(
      `${byLevel['BAJO']} incidente(s) BAJO: Documentar accesos fuera de horario e implementar controles de acceso basados en tiempo.`
    );
    recs.push('Mantener actualizados los sistemas de detección de intrusiones (IDS/IPS) y las firmas de amenazas.');
    recs.push('Documentar todos los incidentes y realizar análisis post-mortem semanal con el equipo SOC.');
    for (const r of recs) para('• ' + r);

    // ── 10. Conclusiones ────────────────────────────────────────────────────
    checkY(20);
    sectionTitle('10', 'Conclusiones');
    const rate = session.totalRecords > 0
      ? ((incidents.length / session.totalRecords) * 100).toFixed(2) : '0.00';
    para(
      `El análisis procesó ${session.totalRecords.toLocaleString('es-ES')} registros del archivo "${session.file?.name ?? 'N/A'}", ` +
      `detectando ${incidents.length} incidentes (tasa de detección: ${rate} %). ` +
      (byLevel['CRÍTICO'] > 0
        ? `La presencia de ${byLevel['CRÍTICO']} incidente(s) CRÍTICO requiere atención inmediata. `
        : '') +
      (incidents.length === 0
        ? 'No se detectaron incidentes de seguridad en el período analizado.'
        : `En total ${byLevel['CRÍTICO'] + byLevel['ALTO']} incidente(s) presentan nivel CRÍTICO o ALTO.`) +
      ' Este informe fue generado automáticamente por SOC Incident Analyzer. Los hallazgos deben ser validados por un analista certificado.'
    );
    if (topIPs.length > 0) {
      para(`La IP con mayor actividad fue ${topIPs[0].value} con ${topIPs[0].count} evento(s).`);
    }

    // Footer on page 1
    doc.setPage(1);
    doc.setFontSize(7);
    doc.setTextColor(...C.muted as RGB);
    doc.text('SOC Incident Analyzer — Informe Confidencial', 14, H - 8);
    doc.text('Pág. 1', W - 14, H - 8, { align: 'right' });

    return doc.output('blob');

  } catch (error: unknown) {
    console.error('[PDFGenerator] Error:', error);
    const cause = error instanceof Error ? error.message : String(error);
    const appError: AppError = {
      code: 'PDF_GENERATION_ERROR',
      message: 'No se pudo generar el informe PDF.',
      cause,
      suggestedAction: 'Recargue la página e intente nuevamente.',
    };
    throw appError;
  }
}
