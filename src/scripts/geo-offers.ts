import restricted from '../../data/monetization/vpn-restricted-countries.json';
import { shouldHideVpn } from '../lib/monetization/geo';

const KEY = 'visitor-country';

/** Visitor country from /api/geo/, fetched once per session. */
async function visitorCountry(): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached !== null) return cached || null;
  } catch {
    // sessionStorage unavailable: fall through to a network request.
  }
  try {
    const response = await fetch('/api/geo/', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const { country } = (await response.json()) as { country: string | null };
    try {
      sessionStorage.setItem(KEY, country ?? '');
    } catch {
      // Ignore: the next page asks again.
    }
    return country;
  } catch {
    return null;
  }
}

/** Hides VPN offers in place (visibility, not display: the reserved space stays, no layout shift). */
export async function hideRestrictedOffers(): Promise<void> {
  const cards = document.querySelectorAll<HTMLElement>('[data-affiliate][data-vpn]');
  if (cards.length === 0) return;
  const visitor = await visitorCountry();
  for (const card of cards) {
    if (shouldHideVpn(visitor, card.dataset.pageCountry, restricted.countries)) {
      card.dataset.hidden = '';
      card.setAttribute('aria-hidden', 'true');
      card.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
    }
  }
}
