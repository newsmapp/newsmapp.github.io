/** Response helpers shared by the on-demand routes. */

export const NO_STORE = { 'cache-control': 'no-store' } as const;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE, ...headers },
  });
}

/** Error body the forms understand: a message plus optional per-field messages. */
export const problem = (status: number, error: string, fields?: Record<string, string>): Response =>
  json(fields ? { error, fields } : { error }, status);

export const MAX_BODY_BYTES = 16_384;

/**
 * Reads the body as text, stopping as soon as it passes `maxBytes`, whether or not the client
 * declared a Content-Length. Throws a 413 Response when it is too large.
 */
export async function readText(request: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const tooLarge = problem(413, 'The request is too large.');
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw tooLarge;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Reads a JSON body up to `maxBytes`. Throws a Response when the body is unusable. */
export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const text = await readText(request, maxBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw problem(400, 'The request body is not valid JSON.');
  }
}

/** What to tell a person for each form field; schema messages are for developers. */
const FIELD_MESSAGES: Record<string, string> = {
  outlet_name: 'Enter the outlet name.',
  url: 'Enter the full address, starting with https://.',
  contact_email: 'Enter a valid e-mail address.',
  country_iso: 'Choose a country.',
  category: 'Choose a category.',
  plan: 'Choose monthly or yearly.',
  outlet_id: 'Choose an outlet from the list.',
  field: 'Choose what is wrong.',
  message: 'Describe the correction in up to 2,000 characters.',
  note: 'Keep the note under 1,000 characters.',
  turnstile_token: 'Complete the anti-spam check.',
};

/** Zod issues → { field: message } for inline form errors. */
export function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    fields[key] ??= FIELD_MESSAGES[key] ?? 'Check this field.';
  }
  return fields;
}

export const clientIp = (request: Request): string => request.headers.get('cf-connecting-ip') ?? '';

/** Visitor country from Cloudflare's IP geolocation; null when unknown or anonymized (XX, T1). */
export function visitorCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const country = (cf?.country ?? request.headers.get('cf-ipcountry') ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : null;
}

/** CSRF check for state-changing requests: the Origin must be this site. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

/** Wraps a handler so thrown Responses (validation, limits) are returned as-is. */
export async function respond(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return problem(500, 'Something failed on our side. Please try again in a minute.');
  }
}
