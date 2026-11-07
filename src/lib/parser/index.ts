/**
 * lib/parser/index.ts — SheetJS wrapper
 *
 * Responsabilidad única: leer un ArrayBuffer (xlsx / xls / csv) con SheetJS
 * y devolver las filas crudas y los encabezados detectados.
 *
 * Contratos:
 *  - parseFile: no lanza nunca por archivo vacío; lanza AppError FILE_CORRUPTED
 *    si el archivo es ilegible o si la extensión no es manejable.
 *  - getPreviewRows: función pura, sin efectos laterales.
 */

import * as XLSX from 'xlsx';
import type { ParseResult, RawRow, AppError } from '../../types';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Construye un AppError con code FILE_CORRUPTED para propagar al store/Worker.
 */
function makeCorruptedError(cause: string): AppError {
  return {
    code: 'FILE_CORRUPTED',
    message: 'El archivo no pudo ser leído. Es posible que esté dañado o en un formato no válido.',
    cause,
    suggestedAction:
      'Verifique que el archivo no esté dañado y vuelva a intentarlo. ' +
      'Si el problema persiste, exporte el archivo desde la aplicación original y cárguelo de nuevo.',
  };
}

/**
 * Normaliza la extensión a minúsculas y verifica que sea .xlsx, .xls o .csv.
 * Devuelve la extensión normalizada o lanza AppError FILE_CORRUPTED si no es soportada.
 */
function normalizeExtension(fileExtension: string): '.xlsx' | '.xls' | '.csv' {
  const ext = fileExtension.toLowerCase().trim() as '.xlsx' | '.xls' | '.csv';
  if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
    throw makeCorruptedError(
      `Extensión no soportada: "${fileExtension}". Solo se aceptan .xlsx, .xls y .csv.`,
    );
  }
  return ext;
}

/**
 * Devuelve el tipo de lectura que espera SheetJS para los tres formatos
 * soportados. Los tres pueden leerse desde un Uint8Array con type 'array'.
 */
function xlsxReadType(_ext: '.xlsx' | '.xls' | '.csv'): 'array' {
  return 'array';
}

// ---------------------------------------------------------------------------
// Exportaciones públicas
// ---------------------------------------------------------------------------

/**
 * Parsea un archivo de logs (xlsx / xls / csv) dado como ArrayBuffer.
 *
 * @param buffer        — Contenido binario del archivo
 * @param fileExtension — Extensión incluyendo el punto, ej. ".xlsx"
 * @returns ParseResult con headers, rows, sheetName y multipleSheets
 *
 * @throws {AppError} con code FILE_CORRUPTED si el archivo es ilegible,
 *         la extensión no está soportada, o SheetJS no puede procesarlo.
 *
 * Nota: un archivo vacío (sin filas de datos) es válido en esta capa —
 * devolverá headers vacío y rows vacío. La validación de "sin registros"
 * es responsabilidad del Worker / store.
 */
export async function parseFile(
  buffer: ArrayBuffer,
  fileExtension: string,
): Promise<ParseResult> {
  // 1. Validar y normalizar la extensión
  const ext = normalizeExtension(fileExtension);

  let workbook: XLSX.WorkBook;

  try {
    // 2. Leer el workbook con SheetJS.
    //    cellDates: true  → SheetJS devuelve objetos Date en lugar de números seriales
    //    raw: false        → los valores se convierten a string cuando es posible
    workbook = XLSX.read(new Uint8Array(buffer), {
      type: xlsxReadType(ext),
      cellDates: true,
      raw: false,
      // Para CSV indicamos codificación UTF-8
      ...(ext === '.csv' ? { codepage: 65001 } : {}),
    });
  } catch (err) {
    throw makeCorruptedError(
      `SheetJS no pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 3. Verificar que el workbook contiene al menos una hoja
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw makeCorruptedError('El workbook no contiene ninguna hoja.');
  }

  const multipleSheets = workbook.SheetNames.length > 1;

  // 4. Tomar siempre la primera hoja
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw makeCorruptedError(`No se pudo acceder a la hoja "${sheetName}".`);
  }

  // 5. Convertir a array de objetos JS.
  //    header: 1  → primera fila es la cabecera (SheetJS la usa como keys)
  //    defval: '' → las celdas vacías se representan como string vacío
  let rawData: unknown[][];
  try {
    rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });
  } catch (err) {
    throw makeCorruptedError(
      `Error al convertir la hoja a JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 6. Separar encabezados de filas de datos
  if (rawData.length === 0) {
    // Archivo completamente vacío (ni encabezados)
    return { headers: [], rows: [], sheetName, multipleSheets };
  }

  // La primera fila es la cabecera
  const headerRow = rawData[0];
  const headers: string[] = headerRow.map((h) =>
    h !== null && h !== undefined ? String(h).trim() : '',
  );

  // Las filas restantes son los datos
  const dataRows = rawData.slice(1);

  if (dataRows.length === 0) {
    // Solo había cabecera, sin datos
    return { headers, rows: [], sheetName, multipleSheets };
  }

  // 7. Convertir cada fila (array) a RawRow (objeto con headers como keys)
  const rows: RawRow[] = dataRows.map((row) => {
    const record: RawRow = {};
    headers.forEach((header, idx) => {
      // Usar el encabezado como clave; si está vacío usar la letra de columna
      const key = header || XLSX.utils.encode_col(idx);
      record[key] = (row as unknown[])[idx] ?? '';
    });
    return record;
  });

  return { headers, rows, sheetName, multipleSheets };
}

/**
 * Devuelve las primeras `limit` filas del array de datos crudos.
 *
 * @param rows  — Array de filas crudas (RawRow[])
 * @param limit — Número máximo de filas a devolver (por defecto 20)
 * @returns     min(rows.length, limit) filas
 */
export function getPreviewRows(rows: RawRow[], limit = 20): RawRow[] {
  return rows.slice(0, limit);
}
