/** Whether a VPN offer must be hidden: restricted visitor country, or the page's own country. */
export function shouldHideVpn(
  visitor: string | null,
  pageCountry: string | undefined,
  restricted: readonly string[],
): boolean {
  if (!visitor) return false;
  return restricted.includes(visitor) || visitor === pageCountry;
}
