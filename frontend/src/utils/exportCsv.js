/** Download rows as a CSV file. `columns` is [{ header, value: (row) => any }]. */
export function exportCsv(fileName, columns, rows) {
  const escapeCell = (cell) => {
    const text = cell === null || cell === undefined ? '' : String(cell);
    // Prefix formula-looking cells so spreadsheets do not execute them (CSV injection).
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const lines = [columns.map((column) => escapeCell(column.header)).join(',')];
  rows.forEach((row) => lines.push(columns.map((column) => escapeCell(column.value(row))).join(',')));
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
