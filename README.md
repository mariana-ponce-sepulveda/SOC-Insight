# 🔐 SOC Incident Analyzer

**Herramienta de análisis y clasificación de incidentes de seguridad para entornos SOC.**

SOC Incident Analyzer es una aplicación web diseñada para facilitar el análisis inicial de registros de seguridad (logs), identificar eventos sospechosos y clasificar posibles incidentes según su nivel de criticidad.

Su objetivo es ayudar a organizar los hallazgos, revisar evidencias y priorizar la atención de incidentes mediante un panel de resultados y la generación de informes PDF.

## 🎯 Objetivo del proyecto

Desarrollar una herramienta que permita procesar archivos de registros de seguridad, aplicar reglas de detección y presentar resultados de manera organizada para apoyar el trabajo de análisis en un entorno SOC (Security Operations Center).

## ✨ Funcionalidades principales

- **Carga de archivos:** permite trabajar con archivos Excel (`.xlsx`, `.xls`) y CSV (`.csv`).
- **Procesamiento de registros:** lectura y normalización de información de seguridad.
- **Detección de incidentes:** aplicación de reglas para identificar eventos sospechosos.
- **Clasificación por criticidad:** niveles CRÍTICO, ALTO, MEDIO y BAJO.
- **Dashboard:** visualización de estadísticas y distribución de incidentes.
- **Análisis de eventos:** identificación de tipos de eventos frecuentes.
- **IPs involucradas:** identificación de direcciones IP con mayor actividad.
- **Evidencias:** revisión de registros asociados a los incidentes detectados.
- **Informe PDF:** generación de un documento con hallazgos, metodología, evidencias, criticidad y recomendaciones de mitigación.

## 🛡️ Reglas de detección

El motor de análisis contempla cinco reglas principales:

| Regla | Nivel | Descripción |
|---|---|---|
| AUTH_FAILURE | MEDIO | Detecta intentos fallidos de autenticación. |
| UNAUTHORIZED_ACCESS | ALTO | Identifica accesos no autorizados. |
| AFTER_HOURS | BAJO | Detecta actividad fuera del horario laboral. |
| BRUTE_FORCE | CRÍTICO | Identifica cinco o más fallos desde una misma IP en una ventana de 10 minutos. |
| CRITICAL_SEVERITY | CRÍTICO | Identifica eventos con severidad crítica explícita. |

Cuando un registro cumple más de una regla, se considera el nivel de mayor severidad.

## ⚙️ Tecnologías

El diseño técnico del proyecto contempla:

- React
- TypeScript
- Vite
- Zustand
- SheetJS (XLSX)
- Web Workers
- Recharts
- @react-pdf/renderer
- Tailwind CSS


## 📄 Informe de seguridad

La aplicación genera un informe PDF que contiene:

1. Portada e información del análisis.
2. Resumen ejecutivo.
3. Descripción del archivo analizado.
4. Metodología de detección.
5. Estadísticas generales.
6. Listado de incidentes.
7. Evidencias y registros de respaldo.
8. IPs y usuarios involucrados.
9. Recomendaciones de mitigación.
10. Conclusiones.

## 🔒 Seguridad y privacidad

El enfoque de procesamiento es local-first: los archivos se analizan en el navegador del usuario, sin transmitir sus datos a servidores externos, según el diseño y el informe de prueba.

Los resultados deben ser revisados y validados por un analista de seguridad antes de tomar decisiones operativas.

## 🚀 Flujo de funcionamiento

1. Seleccionar un archivo de logs.
2. Cargar el archivo en la aplicación.
3. Ejecutar el análisis.
4. Procesar los registros y aplicar las reglas de detección.
5. Visualizar estadísticas e incidentes.
6. Revisar evidencias y niveles de criticidad.
7. Generar el informe PDF.

## 🎥 Demostración

Video demostrativo del funcionamiento de SOC Incident Analyzer:

*Enlace pendiente de incorporar.*

## 👩‍💻 Autora

**Mariana Ponce Sepúlveda**

Proyecto desarrollado como parte de mi proceso de aprendizaje y formación en ciberseguridad, con enfoque en análisis de registros, detección de eventos y gestión de incidentes en entornos SOC.

---

*SOC Incident Analyzer — Análisis, detección y priorización de incidentes de seguridad.*
