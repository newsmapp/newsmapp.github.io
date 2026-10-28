/** Escapes text for XML and SVG element content and attribute values. */
export const escapeXml = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );
