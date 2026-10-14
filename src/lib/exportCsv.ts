/** One column of an export: its heading and how to read the value from a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/**
 * A cell as CSV wants it. Text that starts like a formula is prefixed with an apostrophe so Excel
 * shows it as text instead of running it, since the content comes from what users typed.
 */
function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Saves rows as a .csv file the browser downloads. The file starts with a byte-order mark so Excel
 * reads it as UTF-8 and shows Thai text correctly.
 */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const lines = [columns.map((c) => cell(c.header)).join(','), ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(','))];
  const blob = new Blob(['﻿', lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
