import ExcelJS from 'exceljs';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10MB cap to guard against large spreadsheet DoS

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function normalizeCellValue(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined) {
      return normalizeCellValue(val.result as ExcelJS.CellValue);
    }
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text).join('');
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text;
    }
    return '';
  }
  return String(val);
}

/**
 * Safely parse an uploaded .xlsx or .csv file into an array of keyed row objects.
 */
export async function readSpreadsheetFile(file: File): Promise<Record<string, any>[]> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('File exceeds maximum allowed size of 10MB');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    const matrix = parseCsvText(text);
    if (matrix.length < 2) return [];
    const headers = matrix[0].map((h) => h.trim());
    return matrix.slice(1).map((vals) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = vals[idx] ?? '';
      });
      return obj;
    });
  }

  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return [];

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeCellValue(cell.value).trim();
  });

  const results: Record<string, any>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, any> = {};
    let hasValue = false;
    for (let c = 1; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const strVal = normalizeCellValue(row.getCell(c).value);
      if (strVal.trim() !== '') hasValue = true;
      obj[key] = strVal;
    }
    if (hasValue) {
      results.push(obj);
    }
  }
  return results;
}

export async function exportObjectsToXlsx(
  rows: Record<string, any>[],
  headers: string[],
  sheetName: string,
  fileName: string,
  colWidths?: number[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = headers.map((h, idx) => ({
    header: h,
    key: h,
    width: colWidths?.[idx] ?? Math.max(14, h.length + 4),
  }));
  rows.forEach((r) => {
    const ordered: Record<string, any> = {};
    headers.forEach((h) => {
      ordered[h] = r[h] ?? '';
    });
    ws.addRow(ordered);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName);
}

export async function exportAoaToXlsx(
  headers: string[],
  rows: any[][],
  sheetName: string,
  fileName: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName);
}

export function exportAoaToCsv(headers: string[], rows: any[][], fileName: string): void {
  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers, ...rows].map((row) => row.map(escapeCsv).join(','));
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, fileName);
}
