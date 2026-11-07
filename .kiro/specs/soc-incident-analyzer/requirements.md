# Requirements Document

## Introduction

El **SOC Incident Analyzer** es una aplicación web para laboratorios de SOC Nivel 2 que permite cargar archivos de registros de seguridad en formato Excel o CSV, procesarlos íntegramente en el navegador, detectar y clasificar incidentes de seguridad según nivel de riesgo, visualizarlos en un dashboard interactivo y generar un informe PDF profesional listo para entregar al cliente. Todo el procesamiento ocurre localmente; ningún dato se envía a servicios externos.

---

## Glossary

- **Aplicación**: La aplicación web SOC Incident Analyzer ejecutándose en el navegador del usuario.
- **Analizador**: Componente de la Aplicación responsable de procesar registros e identificar incidentes.
- **Archivo_de_logs**: Archivo en formato `.xlsx`, `.xls` o `.csv` que contiene registros de eventos de seguridad.
- **Registro**: Fila individual dentro del Archivo_de_logs que representa un evento de seguridad.
- **Sesión**: Estado activo en la Aplicación desde que se carga un Archivo_de_logs hasta que se reemplaza por otro o se limpia manualmente.
- **Incidente**: Agrupación de uno o más Registros que el Analizador clasifica como relevante para la seguridad.
- **Nivel_de_riesgo**: Clasificación de severidad de un Incidente: CRÍTICO, ALTO, MEDIO, BAJO o INFORMATIVO.
- **Dashboard**: Panel principal de la Aplicación que muestra indicadores y visualizaciones basados en la Sesión activa.
- **Informe_PDF**: Documento PDF generado por la Aplicación que resume los resultados del análisis de la Sesión activa.
- **Generador_PDF**: Componente de la Aplicación responsable de construir y exportar el Informe_PDF.
- **Exportador**: Componente de la Aplicación responsable de exportar datos en formato CSV o Excel.
- **Filtro**: Criterio de selección aplicado por el usuario sobre los Registros o Incidentes visibles.

---

## Requirements

### Requisito 1: Carga de archivos de logs

**User Story:** Como analista de SOC, quiero cargar un archivo Excel o CSV con registros de eventos, para que la Aplicación pueda procesarlo y mostrarme los resultados del análisis.

#### Criterios de Aceptación

1. THE Aplicación SHALL aceptar archivos con extensiones `.xlsx`, `.xls` y `.csv` mediante un botón de selección de archivo.
2. WHEN el usuario selecciona un archivo, THE Aplicación SHALL mostrar el nombre y el tamaño del archivo expresado en kilobytes (KB) o megabytes (MB) con dos decimales de precisión antes de iniciar el procesamiento.
3. WHEN el usuario selecciona un archivo con extensión distinta a `.xlsx`, `.xls` o `.csv`, THE Aplicación SHALL mostrar un mensaje de error en español indicando las extensiones permitidas e impedir el procesamiento.
4. WHEN el usuario selecciona un archivo cuyo tamaño supera 50 MB, THE Aplicación SHALL mostrar un mensaje de advertencia en español indicando que el límite máximo es 50 MB e impedir el procesamiento.
5. WHEN el archivo es válido y ha sido cargado, THE Aplicación SHALL mostrar una vista previa con las primeras 20 filas de datos del archivo, incluyendo una fila de encabezado con los nombres de columna detectados.
6. IF el archivo está vacío o contiene únicamente la fila de encabezado sin filas de datos, THEN THE Aplicación SHALL mostrar un mensaje de error en español indicando que el archivo no contiene registros e impedir el procesamiento.
7. WHEN el usuario carga un nuevo Archivo_de_logs mientras existe una Sesión activa, THE Aplicación SHALL descartar completamente los datos de la Sesión anterior antes de iniciar el procesamiento del nuevo archivo.
8. IF el archivo tiene extensión `.xlsx` o `.xls` y contiene más de una hoja, THEN THE Aplicación SHALL procesar únicamente la primera hoja del archivo y mostrar un mensaje informativo en español indicando que solo se procesará la primera hoja.
9. IF durante la carga el archivo resulta ilegible o corrupto, THEN THE Aplicación SHALL mostrar un mensaje de error en español indicando que el archivo no pudo ser leído e impedir el procesamiento.

---

### Requisito 2: Procesamiento y normalización de registros

**User Story:** Como analista de SOC, quiero que la Aplicación lea y normalice los registros del archivo cargado, para que el análisis se base en los datos reales sin asumir columnas predefinidas.

#### Criterios de Aceptación

1. WHEN un Archivo_de_logs válido es cargado, THE Analizador SHALL leer todas las filas del archivo y mapear cada columna detectada a los campos reconocidos disponibles: fecha/hora, IP de origen, IP de destino, usuario, tipo de evento, sistema de origen, descripción y estado.
2. WHEN una columna del Archivo_de_logs no corresponde a ningún campo reconocido, THE Analizador SHALL conservar el valor original de esa columna sin modificarlo y sin asignarle un campo estándar.
3. WHEN un campo reconocido no está presente en el Archivo_de_logs, THE Analizador SHALL marcar ese campo como ausente en todos los Registros y no inventar ni inferir valores para ese campo.
4. WHEN el campo de fecha/hora está presente en los Registros y el valor es parseable, THE Analizador SHALL normalizar ese valor al formato ISO 8601 con perfil YYYY-MM-DDTHH:MM:SS±HH:MM.
5. IF un valor de fecha/hora no es parseable, THEN THE Analizador SHALL conservar el valor original como texto y marcar ese campo como "no normalizado" en el Registro sin alterar ningún otro campo del mismo.
6. WHEN el Analizador inicia la lectura de un Archivo_de_logs, THE Analizador SHALL completar el procesamiento de todos los Registros en menos de 30 segundos para archivos de hasta 50.000 filas.
7. WHILE el procesamiento está en curso, THE Aplicación SHALL mostrar un indicador de progreso que se actualice como mínimo cada 2 segundos y refleje el porcentaje de filas procesadas sobre el total de filas del archivo.
8. IF el Archivo_de_logs no contiene filas de datos (archivo vacío o solo encabezado), THEN THE Analizador SHALL completar sin error, notificar al usuario mediante un mensaje descriptivo en español y establecer el total de Registros procesados en cero.
9. IF durante el procesamiento una fila del Archivo_de_logs resulta ilegible por error de formato o codificación, THEN THE Analizador SHALL omitir esa fila, registrar el número de fila y la causa del error en un log interno, y continuar el procesamiento del resto del archivo.

---

### Requisito 3: Detección y clasificación de incidentes

**User Story:** Como analista de SOC, quiero que la Aplicación detecte y clasifique automáticamente incidentes de seguridad en los registros, para que pueda identificar rápidamente los eventos que requieren atención.

#### Criterios de Aceptación

1. WHEN el procesamiento de Registros finaliza, THE Analizador SHALL evaluar cada Registro aplicando reglas de detección para las siguientes categorías: intentos fallidos de autenticación, accesos no autorizados, actividad fuera del horario laboral definido en la configuración (por defecto: lunes a viernes de 08:00 a 18:00 hora local), IPs de origen que superen el umbral de fuerza bruta definido en el Criterio 6, ataques de fuerza bruta y eventos cuyo campo de severidad en los datos de origen indique explícitamente un nivel crítico.
2. WHEN un Registro activa una o más reglas de detección, THE Analizador SHALL asignar al Incidente resultante exactamente uno de los siguientes Niveles_de_riesgo en orden descendente de severidad: CRÍTICO, ALTO, MEDIO, BAJO o INFORMATIVO, seleccionando el nivel correspondiente a la regla de mayor severidad activada según ese orden.
3. WHEN un Incidente es generado, THE Analizador SHALL asociar a ese Incidente un motivo de clasificación en texto legible que identifique el nombre de la regla o reglas que activaron la detección y el Nivel_de_riesgo asignado.
4. WHEN un Incidente es generado, THE Analizador SHALL asociar a ese Incidente el conjunto de Registros de respaldo que originaron su detección, preservando todos los campos originales de cada Registro de respaldo.
5. WHEN un campo necesario para aplicar una regla de detección está ausente en los Registros, THE Analizador SHALL omitir esa regla sin generar falsos positivos ni reportar errores al usuario por esa omisión.
6. IF los campos de IP de origen, estado de autenticación y fecha/hora están disponibles en los Registros, THEN THE Analizador SHALL detectar como fuerza bruta cualquier IP de origen que acumule 5 o más Registros de intento fallido de autenticación dentro de una ventana deslizante de 10 minutos.
7. IF un Registro activa la regla de eventos críticos del Criterio 1, THEN THE Analizador SHALL asignar el Nivel_de_riesgo CRÍTICO únicamente cuando el campo de severidad del Registro contenga de forma explícita un valor que indique nivel crítico en los datos de origen; IF ese campo está ausente o contiene un valor distinto a crítico, THEN THE Analizador SHALL asignar el Nivel_de_riesgo correspondiente a la regla de mayor severidad entre las demás reglas activadas.

---

### Requisito 4: Dashboard y visualización

**User Story:** Como analista de SOC, quiero ver un dashboard con indicadores y gráficos basados en los datos analizados, para que pueda comprender el panorama de seguridad de forma rápida y visual.

#### Criterios de Aceptación

1. WHEN el análisis finaliza, THE Dashboard SHALL mostrar los siguientes indicadores calculados exclusivamente a partir de los Registros de la Sesión activa: total de registros procesados, total de incidentes detectados, conteo de incidentes por cada Nivel_de_riesgo.
2. THE Dashboard SHALL mostrar una distribución de incidentes por Nivel_de_riesgo representada en un gráfico de barras o de pastel, donde cada segmento o barra identifica el Nivel_de_riesgo y muestra su conteo absoluto y porcentaje sobre el total de incidentes detectados.
3. WHEN el campo de fecha/hora está disponible en los Registros, THE Dashboard SHALL mostrar un gráfico de evolución temporal con la frecuencia de eventos agrupados por hora si el rango total de fechas de los Registros es menor o igual a 48 horas, o agrupados por día si el rango total supera las 48 horas.
4. WHEN el campo de IP de origen está disponible en los Registros, THE Dashboard SHALL mostrar una tabla con las 10 IPs de origen con mayor cantidad de Registros asociados, ordenadas de mayor a menor conteo, mostrando la IP y su conteo por columna.
5. WHEN el campo de tipo de evento está disponible en los Registros, THE Dashboard SHALL mostrar una tabla con los 10 tipos de evento más frecuentes, ordenados de mayor a menor conteo, mostrando el tipo de evento y su conteo por columna.
6. THE Dashboard SHALL ofrecer Filtros por Nivel_de_riesgo, por rango de fecha/hora y por IP de origen que actualicen todas las visualizaciones y tablas del Dashboard en un plazo máximo de 2 segundos tras cada cambio de filtro.
7. THE Dashboard SHALL ser responsivo y mostrarse sin truncamiento de contenido ni superposición de elementos en pantallas de ancho mínimo 320 px y máximo 2560 px.
8. WHEN no existe una Sesión activa, THE Dashboard SHALL mostrar un estado vacío con instrucciones para cargar un archivo.
9. IF los Registros de la Sesión activa no contienen incidentes detectados, THEN THE Dashboard SHALL mostrar los indicadores con valor cero y los gráficos y tablas en estado vacío con un mensaje indicando que no se encontraron incidentes.
10. IF un Filtro activo produce un subconjunto de Registros vacío, THEN THE Dashboard SHALL mostrar todos los indicadores, gráficos y tablas en estado vacío con un mensaje indicando que no hay datos para los filtros seleccionados.

---

### Requisito 5: Generación de informe PDF

**User Story:** Como analista de SOC, quiero generar un informe PDF profesional con los resultados del análisis, para que pueda entregarlo al cliente como documentación formal del incidente.

#### Criterios de Aceptación

1. WHEN el análisis ha finalizado, THE Generador_PDF SHALL habilitar un botón de generación de Informe_PDF visible en la interfaz.
2. WHEN el usuario activa la generación del Informe_PDF, THE Generador_PDF SHALL producir un documento PDF que contenga en orden: portada con nombre del informe y fecha de generación, resumen ejecutivo, descripción del Archivo_de_logs analizado, metodología de análisis, estadísticas generales, listado de Incidentes con su Nivel_de_riesgo y motivo, evidencias y Registros de respaldo por Incidente, IPs y usuarios involucrados, recomendaciones de mitigación derivadas de los Niveles_de_riesgo detectados y conclusiones basadas en las estadísticas generales de la Sesión.
3. WHILE existe una Sesión activa con análisis completado, THE Generador_PDF SHALL generar el Informe_PDF exclusivamente con datos reales de dicha Sesión, sin incluir datos de marcador de posición ni datos ficticios.
4. WHEN el Informe_PDF ha sido generado, THE Generador_PDF SHALL habilitar un botón de descarga que permita al usuario guardar el archivo en su dispositivo.
5. WHEN el usuario activa la generación del Informe_PDF para una Sesión con hasta 500 Incidentes, THE Generador_PDF SHALL completar y entregar el Informe_PDF en menos de 60 segundos.
6. WHEN el Informe_PDF ha sido generado, THE Generador_PDF SHALL producir un archivo que cumpla con la especificación PDF 1.4 o superior, de modo que pueda abrirse sin errores en Adobe Acrobat Reader y en los navegadores Chrome, Firefox y Edge en sus versiones estables más recientes.
7. WHILE no existe una Sesión activa con análisis completado, THE Generador_PDF SHALL mantener el botón de generación deshabilitado.
8. IF la generación del Informe_PDF falla, THEN THE Generador_PDF SHALL mostrar un mensaje de error indicando que la generación no pudo completarse, descartar el archivo parcial generado y restablecer el botón de generación al estado habilitado para permitir un nuevo intento.

---

### Requisito 6: Gestión de resultados y exportación

**User Story:** Como analista de SOC, quiero consultar, filtrar y exportar los resultados del análisis, para que pueda gestionar la información de incidentes de manera flexible y documentar la evidencia.

#### Criterios de Aceptación

1. WHEN el análisis ha finalizado, THE Aplicación SHALL mostrar una vista de detalle de Incidentes que liste cada Incidente con su Nivel_de_riesgo, motivo de clasificación y Registros de respaldo asociados.
2. THE Aplicación SHALL permitir al usuario aplicar Filtros por Nivel_de_riesgo sobre la lista de Incidentes, actualizando la vista en un plazo máximo de 300 milisegundos tras cada cambio de filtro, sin recargar la página.
3. WHEN el usuario solicita exportar los Incidentes detectados, THE Exportador SHALL generar un archivo en formato CSV o Excel que contenga al menos los campos: identificador de incidente, Nivel_de_riesgo, motivo, fecha del primer Registro de respaldo en formato ISO 8601 y conteo de Registros asociados.
4. THE Exportador SHALL exportar únicamente los Incidentes visibles según los Filtros activos en el momento de la exportación.
5. WHEN el usuario carga un nuevo Archivo_de_logs, THE Aplicación SHALL limpiar completamente los resultados de la Sesión anterior incluyendo: lista de Incidentes, Filtros activos, indicadores del Dashboard, gráficos y tablas, antes de mostrar los resultados del nuevo archivo.
6. IF el usuario intenta exportar o generar un PDF cuando no existe una Sesión activa, THEN THE Aplicación SHALL mostrar un mensaje informativo en español indicando que primero debe cargar un archivo.

---

### Requisito 7: Calidad de la interfaz y experiencia de usuario

**User Story:** Como analista de SOC, quiero una interfaz profesional, en español y adaptada a la temática de seguridad, para que la experiencia de uso sea coherente con el contexto de un laboratorio SOC.

#### Criterios de Aceptación

1. THE Aplicación SHALL presentar todos los textos de la interfaz, mensajes de error, etiquetas y contenido generado en idioma español.
2. THE Aplicación SHALL utilizar una paleta de colores basada en azul oscuro y gris como colores primarios, con detalles de acento en rojo para CRÍTICO, naranja para ALTO, amarillo para MEDIO y verde para BAJO/INFORMATIVO, cumpliendo en todos los casos una relación de contraste mínima de 4.5:1 según WCAG 2.1 AA.
3. THE Aplicación SHALL incluir un icono distinto y relacionado con seguridad informática en cada indicador de Nivel_de_riesgo y en cada elemento principal de navegación.
4. WHEN ocurre un error durante la carga, el procesamiento o la generación del Informe_PDF, THE Aplicación SHALL mostrar un mensaje de error descriptivo en español que indique la causa del problema y la acción correctiva sugerida.
5. THE Aplicación SHALL ser accesible cumpliendo con las pautas WCAG 2.1 nivel AA para contraste de color, navegación por teclado y etiquetas de elementos interactivos.
6. THE Aplicación SHALL funcionar correctamente en las versiones estables disponibles en la fecha de la prueba de Google Chrome, Mozilla Firefox, Microsoft Edge y Safari.
