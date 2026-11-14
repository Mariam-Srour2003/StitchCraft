/** Quotes a CSV field only when it needs it (comma, quote or line break), doubling inner quotes. */
export function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180-style CSV with CRLF line endings and a trailing newline. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
