/**
 * Organic click analytics (H1): links keep their real href; a beacon records the click.
 * Sponsored and affiliate links go through /go/ instead and are not handled here.
 */
document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-track]');
  if (!link || !navigator.sendBeacon) return;
  const { track, country, category } = link.dataset;
  const body = JSON.stringify({ outlet_id: track, country, category: category ?? null });
  navigator.sendBeacon('/api/track/', new Blob([body], { type: 'application/json' }));
});
