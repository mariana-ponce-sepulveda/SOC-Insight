# Implementation Plan: SOC Incident Analyzer

## Overview

Implementar una SPA React + TypeScript que corre íntegramente en el navegador. El plan sigue la separación de capas del diseño: tipos compartidos → utilidades de bajo nivel → Web Worker (parser, normalizer, rule engine) → store Zustand → componentes de UI → exportador y generador PDF. Cada tarea construye sobre la anterior y termina con el cableado de todos los módulos.

---

## Tasks

- [x] 1. Inicializar el proyecto y establecer la estructura base
  - Crear el proyecto Vite + React + TypeScript con `npm create vite@latest soc-insight -- --template react-ts`
  - Instalar dependencias de producción: `xlsx`, `@react-pdf/renderer`, `zustand`, `recharts`, `@tanstack/react-virtual`
  - Instalar dependencias de desarrollo: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `axe-core`, `vite-plugin-worker`
  - Crear la estructura de carpetas descrita en el diseño: `src/assets/`, `src/components/ui/`, `src/components/FileUploader/`, `src/components/Dashboard/`, `src/components/IncidentList/`, `src/components/PDFReport/`, `src/workers/`, `src/lib/parser/`, `src/lib/normalizer/`, `src/lib/ruleEngine/`, `src/lib/pdfGenerator/`, `src/lib/exporter/`, `src/store/`, `src/types/`, `src/constants/`
  - Configurar `vite.config.ts` con `vite-plugin-worker` y soporte de workers
  - Configurar `vitest.config.ts` con jsdom, `@testing-library/jest-dom` y coverage
  - _Requisitos: todos los requisitos técnicos base_

- [x] 2. Definir tipos compartidos y constantes
  - [x] 2.1 Crear `src/types/index.ts` con todos los tipos TypeScript del diseño
    - Implementar: `RawRow`, `RecognizedField`, `NormalizedFieldValue`, `ParseWarning`, `NormalizedRecord`, `RiskLevel`, `TriggeredRule`, `Incident`, `SessionStatus`, `FileMetadata`, `ProcessingError`, `ActiveFilters`, `ActiveSession`, `AppError`, `ParseResult`, `DetectionResult`, `SkippedRule`, `RuleConfig`, `DetectionRule`, `DetectionContext`
    - _Requisitos: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_
  - [x] 2.2 Crear `src/constants/rules.ts` con la configuración de reglas y paleta de colores
    - Definir `RISK_COLORS`, `THEME`, `DEFAULT_RULE_CONFIG`, lista de `DetectionRule` para las 5 reglas del diseño, y `severityOrder`
    - _Requisitos: 3.1, 3.2, 7.2_

- [x] 3. Implementar la capa de parser (SheetJS wrapper)
  - [x] 3.1 Crear `src/lib/parser/index.ts`
    - Implementar `parseFile(buffer: ArrayBuffer, fileExtension: string): Promise<ParseResult>` usando SheetJS
    - Manejar `.xlsx`, `.xls`, `.csv`; si hay múltiples hojas, tomar la hoja 0 y adjuntar advertencia en `ParseResult`
    - _Requisitos: 1.5, 1.8, 1.9, 2.1_
  - [ ]* 3.2 Escribir tests unitarios para el parser
    - Test: parseo de un CSV mínimo con encabezados y 3 filas
    - Test: archivo con múltiples hojas → solo se procesa la primera
    - Test: archivo corrupto → lanza error estructurado
    - _Requisitos: 1.8, 1.9_

- [x] 4. Implementar la capa de normalización
  - [x] 4.1 Crear `src/lib/normalizer/index.ts`
    - Implementar `normalizeRecords(headers: string[], rows: RawRow[]): NormalizedRecord[]`
    - Mapear encabezados a `RecognizedField` mediante comparación case-insensitive y sinónimos del diseño
    - Normalizar fechas a ISO 8601; si no es parseable, conservar original y marcar `'unparseable'`
    - Marcar campos reconocidos ausentes como `'absent'`; preservar columnas extra en `extra`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9_
  - [ ]* 4.2 Escribir prueba de propiedad: Mapeo de columnas reconocidas y preservación de extra
    - **Property 6: Mapeo de columnas reconocidas y preservación de columnas extra**
    - **Valida: Requisitos 2.1, 2.2, 2.3**
    - Usar `fc.array(fc.string())` para generar conjuntos arbitrarios de encabezados
    - Verificar: campos reconocidos mapeados, extras inalterados, ausentes marcados `'absent'`
  - [ ]* 4.3 Escribir prueba de propiedad: Normalización de fechas a ISO 8601
    - **Property 7: Normalización de fechas a ISO 8601**
    - **Valida: Requisitos 2.4, 2.5**
    - Usar `fc.date()` para fechas parseables → verificar output en formato ISO 8601
    - Usar `fc.string()` para cadenas no parseables → verificar valor original conservado y `'unparseable'`
  - [ ]* 4.4 Escribir prueba de propiedad: Tolerancia a filas ilegibles
    - **Property 8: Tolerancia a filas ilegibles**
    - **Valida: Requisito 2.9**
    - Usar `fc.array()` con mezcla de filas válidas e inválidas
    - Verificar que solo filas válidas aparecen en el resultado y `processingErrors` tiene exactamente una entrada por fila ilegible

- [x] 5. Implementar el motor de detección de incidentes
  - [x] 5.1 Crear `src/lib/ruleEngine/index.ts` con las 5 reglas de detección
    - Implementar `detectIncidents(records: NormalizedRecord[], config: RuleConfig): DetectionResult`
    - Implementar reglas: `AUTH_FAILURE`, `UNAUTHORIZED_ACCESS`, `AFTER_HOURS`, `BRUTE_FORCE` (ventana deslizante O(n)), `CRITICAL_SEVERITY`
    - Asignar `riskLevel` como el máximo según `severityOrder`; generar `reason` no vacío referenciando nombre(s) de regla(s)
    - Omitir reglas silenciosamente cuando campos requeridos estén `'absent'`
    - Preservar todos los campos originales en `evidenceRecords`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ]* 5.2 Escribir prueba de propiedad: Asignación del nivel de riesgo máximo
    - **Property 9: Asignación del nivel de riesgo máximo**
    - **Valida: Requisito 3.2**
    - Usar `fc.subarray(['CRÍTICO','ALTO','MEDIO','BAJO','INFORMATIVO'])` para conjuntos no vacíos de reglas disparadas
    - Verificar que el `riskLevel` asignado es el de mayor severidad según `severityOrder`
  - [ ]* 5.3 Escribir prueba de propiedad: Motivo de clasificación no vacío
    - **Property 10: Motivo de clasificación no vacío**
    - **Valida: Requisito 3.3**
    - Usar `fc.record()` para generar incidentes con distintas combinaciones de reglas
    - Verificar que `reason` es cadena no vacía que referencia al menos un nombre de regla disparada
  - [ ]* 5.4 Escribir prueba de propiedad: Preservación de campos originales en evidencias
    - **Property 11: Preservación de campos originales en evidencias**
    - **Valida: Requisito 3.4**
    - Usar `fc.record()` para generar registros con campos extra arbitrarios
    - Verificar que todos los campos originales están presentes e inalterados en `evidenceRecords`
  - [ ]* 5.5 Escribir prueba de propiedad: No generación de falsos positivos por campos ausentes
    - **Property 12: No generación de falsos positivos por campos ausentes**
    - **Valida: Requisito 3.5**
    - Generar registros donde los campos requeridos por cada regla estén marcados `'absent'`
    - Verificar que esa regla no genera ningún incidente
  - [ ]* 5.6 Escribir prueba de propiedad: Detección de fuerza bruta por ventana deslizante
    - **Property 13: Detección de fuerza bruta por ventana deslizante**
    - **Valida: Requisito 3.6**
    - Usar `fc.array(fc.date())` para secuencias de eventos de autenticación fallida por IP
    - Verificar que la detección ocurre si y solo si existe ventana de 10 min con ≥ 5 eventos
  - [ ]* 5.7 Escribir prueba de propiedad: Asignación de CRÍTICO solo por campo de severidad explícito
    - **Property 14: Asignación de CRÍTICO solo por campo de severidad explícito**
    - **Valida: Requisito 3.7**
    - Usar `fc.string()` para generar valores de severidad arbitrarios
    - Verificar que `CRITICAL_SEVERITY` solo se dispara con `"critical"`, `"crítico"` o `"crit"` (case-insensitive)
  - [x] 5.8 Escribir tests unitarios para el motor de reglas
    - Test: fuerza bruta con exactamente 4, 5 y 6 intentos en ventana de 10 min
    - Test: `AFTER_HOURS` con timestamps dentro y fuera de horario laboral
    - Test: `CRITICAL_SEVERITY` con valores `"critical"`, `"CRITICAL"`, `"crit"`, `"high"` y campo ausente
    - Test: campo ausente no genera falso positivo en ninguna regla
    - _Requisitos: 3.1, 3.5, 3.6, 3.7_

- [x] 6. Checkpoint — Validar capa de procesamiento
  - Ejecutar `vitest --run` y verificar que todos los tests de parser, normalizer y ruleEngine pasan.
  - Asegurar que no hay errores de TypeScript con `tsc --noEmit`.
  - Preguntar al usuario si hay dudas antes de continuar.

- [x] 7. Implementar el Web Worker de procesamiento
  - [x] 7.1 Crear `src/workers/processor.worker.ts`
    - Recibir `{ file: ArrayBuffer, fileExtension: string, config: RuleConfig }` via `postMessage`
    - Pipeline: `parseFile` → `normalizeRecords` → `detectIncidents`
    - Emitir mensajes de progreso `{ type: 'progress', progress: number }` cada 1.000 filas (garantizar ≥ cada 2 s)
    - Emitir resultado final `{ type: 'result', records, incidents, errors, fileMetadata }`
    - Emitir errores `{ type: 'error', error: AppError }` en caso de fallo irrecuperable
    - Transferir el `ArrayBuffer` como Transferable object
    - _Requisitos: 2.6, 2.7, 2.9, 1.8, 1.9_

- [x] 8. Implementar el Zustand store
  - [x] 8.1 Crear `src/store/sessionStore.ts`
    - Implementar `SessionStore` con estado inicial `idle` y todas las acciones: `loadFile`, `clearSession`, `setFilters`, `resetFilters`
    - `loadFile` valida extensión y tamaño, instancia el Worker, gestiona mensajes de progreso y resultado
    - Selectores derivados: `filteredIncidents()`, `incidentsByRiskLevel()`
    - _Requisitos: 1.2, 1.3, 1.4, 1.6, 1.7, 6.2, 6.4, 6.5_
  - [ ]* 8.2 Escribir prueba de propiedad: Limpieza completa de sesión al cargar nuevo archivo
    - **Property 5: Limpieza completa de sesión al cargar nuevo archivo**
    - **Valida: Requisitos 1.7, 6.5**
    - Usar `fc.record()` para generar estados de sesión activa arbitrarios
    - Verificar que tras `clearSession()` todos los campos derivados vuelven a valores iniciales sin residuos
  - [ ]* 8.3 Escribir prueba de propiedad: Filtrado por nivel de riesgo
    - **Property 20: Filtrado por nivel de riesgo**
    - **Valida: Requisitos 6.2, 6.4**
    - Usar `fc.array()` + `fc.constantFrom('CRÍTICO','ALTO','MEDIO','BAJO','INFORMATIVO')` para listas e incidentes arbitrarios con nivel arbitrario
    - Verificar que `filteredIncidents()` retorna solo incidentes cuyo `riskLevel` coincide con el filtro activo

- [x] 9. Implementar utilidades de validación de archivo y formateo
  - [x] 9.1 Crear `src/lib/parser/validation.ts`
    - Implementar validación de extensión (`.xlsx`, `.xls`, `.csv`) con mensaje de error en español
    - Implementar validación de tamaño (≤ 50 MB = 52.428.800 bytes) con mensaje de error en español
    - Implementar `formatFileSize(bytes: number): string` → `"X.XX KB"` si < 1 MB, `"X.XX MB"` si ≥ 1 MB
    - _Requisitos: 1.2, 1.3, 1.4_
  - [ ]* 9.2 Escribir prueba de propiedad: Formato de tamaño de archivo
    - **Property 1: Formato de tamaño de archivo**
    - **Valida: Requisito 1.2**
    - Usar `fc.nat()` para bytes arbitrarios
    - Verificar que el resultado tiene exactamente 2 decimales, usa KB si < 1 MB y MB si ≥ 1 MB
  - [ ]* 9.3 Escribir prueba de propiedad: Rechazo de extensiones no permitidas
    - **Property 2: Rechazo de extensiones no permitidas**
    - **Valida: Requisito 1.3**
    - Usar `fc.string()` para nombres de archivo arbitrarios sin extensiones `.xlsx/.xls/.csv`
    - Verificar que la validación devuelve un resultado de error
  - [ ]* 9.4 Escribir prueba de propiedad: Rechazo de archivos que superan 50 MB
    - **Property 3: Rechazo de archivos que superan 50 MB**
    - **Valida: Requisito 1.4**
    - Usar `fc.nat()` para tamaños arbitrarios; verificar rechazo para > 52.428.800 y aceptación para ≤ 52.428.800 con extensión válida
  - [ ]* 9.5 Escribir prueba de propiedad: Vista previa acotada a 20 filas
    - **Property 4: Vista previa acotada a 20 filas**
    - **Valida: Requisito 1.5**
    - Usar `fc.array()` con arrays de tamaño variable
    - Verificar que la función devuelve exactamente `min(filas.length, 20)` filas

- [x] 10. Implementar primitivos de UI
  - [x] 10.1 Crear componentes en `src/components/ui/`: `Button`, `Badge`, `Card`, `Modal`, `Spinner`, `EmptyState`
    - Aplicar paleta de colores y tema del diseño (`RISK_COLORS`, `THEME`)
    - Todos los componentes deben tener roles ARIA y etiquetas accesibles (WCAG 2.1 AA)
    - _Requisitos: 7.1, 7.2, 7.3, 7.5_
  - [ ]* 10.2 Escribir prueba de propiedad: Relaciones de contraste WCAG
    - **Property 22: Relaciones de contraste WCAG**
    - **Valida: Requisito 7.2**
    - Usar `fc.constantFrom()` sobre los pares definidos en `RISK_COLORS` y `THEME`
    - Verificar que cada combinación fondo/texto produce contraste ≥ 4.5:1 según fórmula de luminancia relativa WCAG 2.1

- [x] 11. Implementar el componente FileUploader
  - [x] 11.1 Crear `src/components/FileUploader/index.tsx`
    - Área de drag-and-drop + botón de selección de archivo
    - Mostrar nombre y tamaño formateado antes de procesar
    - Barra de progreso reactiva al `store.progress`
    - Vista previa con las primeras 20 filas (encabezados + datos)
    - Mensajes de error en español para extensión inválida, tamaño excedido, archivo vacío, archivo corrupto, múltiples hojas
    - Disparar `store.loadFile(file)` al aceptar un archivo
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.1, 7.4_
  - [ ]* 11.2 Escribir tests unitarios para FileUploader
    - Test: estado vacío inicial muestra instrucciones
    - Test: drop de archivo con extensión inválida → mensaje de error correcto
    - Test: drop de archivo > 50 MB → mensaje de error con límite y tamaño actual
    - Test: archivo válido → muestra nombre, tamaño formateado y barra de progreso
    - _Requisitos: 1.1, 1.3, 1.4_

- [x] 12. Implementar el store y las estadísticas del dashboard
  - [x] 12.1 Crear `src/lib/stats/index.ts` con funciones de cálculo de estadísticas del dashboard
    - `calcIncidentsByRiskLevel(incidents: Incident[]): Record<RiskLevel, number>`
    - `calcTemporalGroups(records: NormalizedRecord[]): TemporalBucket[]` (por hora ≤ 48 h, por día > 48 h)
    - `calcTopIPs(records: NormalizedRecord[], n?: number): RankedItem[]` (top-10, orden descendente)
    - `calcTopEventTypes(records: NormalizedRecord[], n?: number): RankedItem[]` (top-10, orden descendente)
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 12.2 Escribir prueba de propiedad: Corrección estadística del dashboard
    - **Property 15: Corrección estadística del dashboard**
    - **Valida: Requisitos 4.1, 4.2**
    - Usar `fc.array()` para listas de incidentes arbitrarias
    - Verificar que totales y conteos por nivel coinciden con recuento directo; porcentajes suman 100 % ± 0.01 %
  - [ ]* 12.3 Escribir prueba de propiedad: Agrupación temporal dinámica
    - **Property 16: Agrupación temporal dinámica**
    - **Valida: Requisito 4.3**
    - Usar `fc.array(fc.date())` para conjuntos de timestamps
    - Verificar agrupación por hora cuando rango ≤ 172.800 s y por día cuando rango > 172.800 s
  - [ ]* 12.4 Escribir prueba de propiedad: Top-10 IPs y tipos de evento correctamente ordenados
    - **Property 17: Top-10 IPs y tipos de evento correctamente ordenados**
    - **Valida: Requisitos 4.4, 4.5**
    - Usar `fc.array()` con registros que tienen IP de origen y tipo de evento
    - Verificar orden descendente, longitud `min(elementosDistintos, 10)` y conteos exactos

- [x] 13. Implementar los componentes del Dashboard
  - [x] 13.1 Crear `src/components/Dashboard/SummaryCards/index.tsx`
    - 5 tarjetas de indicadores: total registros, total incidentes, conteo por cada `RiskLevel`
    - Icono de seguridad distinto y color de acento por nivel
    - _Requisitos: 4.1, 7.3_
  - [x] 13.2 Crear `src/components/Dashboard/RiskDistributionChart/index.tsx`
    - `BarChart` o `PieChart` de Recharts con conteo absoluto y porcentaje por nivel
    - _Requisitos: 4.2_
  - [x] 13.3 Crear `src/components/Dashboard/TimelineChart/index.tsx`
    - `AreaChart` de Recharts; solo visible cuando `timestamp` está disponible
    - Agrupación por hora (≤ 48 h) o por día (> 48 h) usando `calcTemporalGroups`
    - _Requisitos: 4.3_
  - [x] 13.4 Crear `src/components/Dashboard/TopIPsTable/index.tsx` y `TopEventTypesTable/index.tsx`
    - Solo visibles cuando los campos correspondientes están disponibles
    - Columnas: valor + conteo, ordenados descendentemente
    - _Requisitos: 4.4, 4.5_
  - [x] 13.5 Crear `src/components/Dashboard/FilterBar/index.tsx`
    - Multi-select de `RiskLevel`, date-range picker, campo de texto para IP de origen
    - Despacha `store.setFilters()` en < 2 s; dashboard se actualiza reactivamente
    - _Requisitos: 4.6, 6.2_
  - [x] 13.6 Crear `src/components/Dashboard/index.tsx` como contenedor principal
    - Estado vacío con instrucciones cuando no hay sesión
    - Estado "sin incidentes" con indicadores en cero cuando `incidents.length === 0`
    - Responsivo 320–2560 px
    - _Requisitos: 4.8, 4.9, 4.10, 4.7_
  - [ ]* 13.7 Escribir tests unitarios para Dashboard
    - Test: estado vacío sin sesión muestra instrucciones
    - Test: estado con incidentes vacíos muestra indicadores en cero
    - Test: filtro activo sin resultados muestra estado vacío con mensaje descriptivo
    - _Requisitos: 4.8, 4.9, 4.10_

- [x] 14. Implementar la lista de incidentes
  - [x] 14.1 Crear `src/components/IncidentList/IncidentCard/index.tsx`
    - Muestra: identificador, badge de `RiskLevel` con color correcto, motivo, fecha y conteo de registros de respaldo
    - Desplegable para ver los registros de respaldo completos
    - _Requisitos: 6.1_
  - [x] 14.2 Crear `src/components/IncidentList/index.tsx` con virtualización
    - Usar `@tanstack/react-virtual` para renderizar solo los elementos visibles
    - Filtrado reactivo por `store.filteredIncidents()` con respuesta < 300 ms
    - _Requisitos: 6.1, 6.2_
  - [ ]* 14.3 Escribir prueba de propiedad: Vista de detalle de incidentes completa
    - **Property 19: Vista de detalle de incidentes completa**
    - **Valida: Requisito 6.1**
    - Usar `fc.array()` para listas de incidentes de tamaño arbitrario
    - Verificar que el componente renderiza exactamente un elemento por incidente mostrando `riskLevel`, `reason` y conteo de registros de respaldo

- [x] 15. Checkpoint — Validar UI base y estado global
  - Ejecutar `vitest --run` y verificar que todos los tests pasan.
  - Verificar `tsc --noEmit` sin errores.
  - Verificar manualmente en el navegador que la carga de un CSV de prueba muestra el dashboard y la lista de incidentes.
  - Preguntar al usuario si hay ajustes antes de continuar con exportación y PDF.

- [x] 16. Implementar el exportador CSV / Excel
  - [x] 16.1 Crear `src/lib/exporter/index.ts`
    - Implementar `exportToCSV(incidents: Incident[]): string`
    - Implementar `exportToExcel(incidents: Incident[]): ArrayBuffer`
    - Campos obligatorios: `id`, `riskLevel`, `reason`, `firstTimestamp` (ISO 8601), `evidenceCount`
    - Exportar únicamente los incidentes del parámetro (filtrados en llamada desde la UI)
    - Si la lista está vacía, retornar string/buffer vacío y la UI mostrará mensaje informativo
    - _Requisitos: 6.3, 6.4_
  - [ ]* 16.2 Escribir prueba de propiedad: Campos obligatorios en exportación
    - **Property 21: Campos obligatorios en exportación**
    - **Valida: Requisito 6.3**
    - Usar `fc.array()` para listas de incidentes arbitrarias
    - Verificar que cada fila del CSV/Excel contiene los 5 campos obligatorios con `firstTimestamp` en formato ISO 8601

- [x] 17. Implementar el generador de PDF
  - [x] 17.1 Crear `src/lib/pdfGenerator/index.ts` y los componentes JSX en `src/components/PDFReport/`
    - Implementar `generatePDF(session: ActiveSession): Promise<Blob>`
    - Construir las 10 secciones del informe en orden: portada, resumen ejecutivo, descripción del archivo, metodología, estadísticas, listado de incidentes, evidencias, IPs y usuarios, recomendaciones, conclusiones
    - Secciones 9 (recomendaciones) y 10 (conclusiones) generadas dinámicamente desde plantillas parametrizadas — sin texto de marcador de posición
    - PDF ≥ 1.4; debe poder abrirse en Acrobat Reader y navegadores Chrome/Firefox/Edge
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 17.2 Escribir prueba de propiedad: Estructura completa del documento PDF
    - **Property 18: Estructura completa del documento PDF**
    - **Valida: Requisitos 5.2, 5.3**
    - Usar `fc.record()` para generar sesiones activas con datos variados
    - Verificar que el árbol de componentes PDF contiene exactamente las 10 secciones en orden y ningún campo contiene cadenas de marcador de posición
  - [ ]* 17.3 Escribir test unitario para manejo de error en generación PDF
    - Test: fallo en `generatePDF` → `AppError` con `message`, `cause` y `suggestedAction` no vacíos
    - Test: blob parcial descartado tras error
    - _Requisitos: 5.8_

- [x] 18. Implementar el componente PDFGenerator y botón de exportación en la UI
  - [x] 18.1 Crear `src/components/PDFReport/PDFGenerator.tsx` y botón de exportación CSV/Excel
    - Botón PDF habilitado solo cuando `store.status === 'ready'`; deshabilitado en los demás estados
    - Spinner durante generación, botón de descarga al finalizar
    - Mensaje de error descriptivo en español si `generatePDF` falla; restablecer botón
    - Botones de exportación CSV y Excel que usan `store.filteredIncidents()` como fuente
    - Mensaje informativo si no hay sesión activa al intentar exportar o generar PDF
    - _Requisitos: 5.1, 5.4, 5.7, 5.8, 6.3, 6.6_
  - [ ]* 18.2 Escribir prueba de propiedad: Modelo de error estructurado
    - **Property 23: Modelo de error estructurado**
    - **Valida: Requisito 7.4**
    - Usar `fc.constantFrom()` sobre los códigos de error definidos en `AppError`
    - Verificar que cada `AppError` emitido tiene `message`, `cause` y `suggestedAction` no vacíos

- [x] 19. Cablear todos los módulos en `App.tsx`
  - [x] 19.1 Componer `App.tsx` integrando `FileUploader`, `Dashboard`, `IncidentList` y `PDFGenerator`
    - Conectar todos los componentes al store Zustand
    - Aplicar layout responsivo (320–2560 px) con el tema oscuro del diseño
    - Verificar que el flujo completo funciona: carga → procesamiento → dashboard → filtros → export → PDF
    - _Requisitos: 1.1, 2.7, 4.6, 4.7, 5.1, 6.1, 7.1, 7.6_
  - [ ]* 19.2 Añadir integración de axe-core para verificación de accesibilidad
    - Configurar `axe-core` en el test runner para verificar roles ARIA, etiquetas y contraste en los componentes principales
    - _Requisitos: 7.5_

- [x] 20. Checkpoint final — Validar cobertura completa
  - Ejecutar `vitest --run` y asegurarse de que todos los tests (unitarios, de propiedad, de integración) pasan.
  - Verificar `tsc --noEmit` sin errores.
  - Preguntar al usuario si hay preguntas o ajustes finales.

---

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para una iteración MVP más rápida.
- Cada tarea referencia requisitos específicos para trazabilidad completa.
- Los checkpoints garantizan validación incremental antes de avanzar a la siguiente capa.
- Las pruebas de propiedad usan **fast-check** con mínimo 100 iteraciones; cada test lleva la etiqueta `// Feature: soc-incident-analyzer, Property N: <texto>`.
- Las pruebas unitarias usan **Vitest** + **@testing-library/react**.
- Ninguna tarea requiere ejecutar la aplicación manualmente; la validación se realiza mediante tests automatizados.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "4.1", "9.1", "10.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3", "4.4", "9.2", "9.3", "9.4", "9.5", "10.2"] },
    { "id": 3, "tasks": ["5.1", "7.1", "8.1", "12.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "8.2", "8.3", "12.2", "12.3", "12.4"] },
    { "id": 5, "tasks": ["11.1", "13.1", "13.2", "13.3", "13.4", "13.5", "14.1", "16.1"] },
    { "id": 6, "tasks": ["11.2", "13.6", "13.7", "14.2", "16.2", "17.1"] },
    { "id": 7, "tasks": ["14.3", "17.2", "17.3"] },
    { "id": 8, "tasks": ["18.1"] },
    { "id": 9, "tasks": ["18.2", "19.1"] },
    { "id": 10, "tasks": ["19.2"] }
  ]
}
```
