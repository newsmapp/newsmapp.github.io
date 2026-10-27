/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF line endings. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Parses CSV with a header row into records keyed by column name. */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(input);
  if (!header) return [];
  const columns = header.map((name) => name.trim());
  return rows.map((cells, index) => {
    if (cells.length !== columns.length) {
      throw new Error(`Row ${index + 2}: expected ${columns.length} fields, got ${cells.length}`);
    }
    return Object.fromEntries(columns.map((name, i) => [name, (cells[i] ?? '').trim()]));
  });
}
