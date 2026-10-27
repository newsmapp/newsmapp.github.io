import { hmacSha256, toHex } from './crypto';

/**
 * Click analytics (H1). Nothing here stores an IP or User-Agent: both only feed a keyed hash
 * whose key changes every UTC day, so visitors cannot be followed across days.
 */
export async function visitorHash(
  secret: string,
  day: string,
  ip: string,
  userAgent: string,
): Promise<string> {
  return toHex(await hmacSha256(`${secret}:${day}`, `${ip}\n${userAgent}`)).slice(0, 32);
}

export type BotBucket = 'human' | 'likely-bot' | 'bot';

const BOT_AGENT =
  /bot|crawl|spider|slurp|headless|preview|fetch|monitor|curl|wget|python|httpclient|java\//i;

/**
 * Coarse bot classification. Uses Cloudflare's bot score when the plan provides it,
 * otherwise the User-Agent. Only "human" clicks count in reports.
 */
export function botBucket(
  userAgent: string,
  score?: number | null,
  verifiedBot?: boolean,
): BotBucket {
  if (verifiedBot) return 'bot';
  if (typeof score === 'number') return score < 10 ? 'bot' : score < 30 ? 'likely-bot' : 'human';
  if (!userAgent || BOT_AGENT.test(userAgent)) return 'bot';
  return 'human';
}

export interface Click {
  outletId: string;
  country: string;
  category: string;
  visitorCountry: string | null;
  sponsored: boolean;
  source: 'beacon' | 'go';
  bot: BotBucket;
  visitor: string;
}

/** Column order matters: the admin queries read blob1…blob7 and double1. */
export function clickDataPoint(click: Click): AnalyticsEngineDataPoint {
  return {
    indexes: [click.outletId],
    blobs: [
      click.outletId,
      click.country,
      click.category,
      click.visitorCountry ?? '',
      click.source,
      click.bot,
      click.visitor,
    ],
    doubles: [click.sponsored ? 1 : 0],
  };
}

/**
 * Filtered clicks: human only, one per visitor and outlet per 30-minute window.
 * Runs against the Analytics Engine SQL API.
 */
export function filteredClicksSql(
  dataset: string,
  days: number,
  groupBy: 'blob1' | 'blob2' | 'blob3',
): string {
  const window = Math.max(1, Math.min(90, Math.trunc(days)));
  return `SELECT ${groupBy} AS key, count(DISTINCT concat(blob7, blob1, toString(intDiv(toUInt32(timestamp), 1800)))) AS clicks
FROM ${dataset}
WHERE timestamp > NOW() - INTERVAL '${window}' DAY AND blob6 = 'human'
GROUP BY key
ORDER BY clicks DESC
LIMIT 100`;
}

// A type alias, not an interface, so rows fit Record<string, unknown> for the CSV export.
export type ClickRow = {
  key: string;
  clicks: number;
};

/** Runs a query on the Analytics Engine SQL API. Returns null when not configured or failing. */
export async function queryClicks(
  accountId: string | undefined,
  token: string | undefined,
  sql: string,
  fetcher: typeof fetch = fetch,
): Promise<ClickRow[] | null> {
  if (!accountId || !token) return null;
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: sql,
    },
  );
  if (!response.ok) return null;
  const { data } = (await response.json()) as { data?: { key: string; clicks: number | string }[] };
  return (data ?? []).map((row) => ({ key: row.key, clicks: Number(row.clicks) }));
}
