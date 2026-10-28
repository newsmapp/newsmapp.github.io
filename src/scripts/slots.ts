/** /advertise/ availability check: open places and price for the chosen country and category. */
interface Prices {
  [iso: string]: { monthly: number; yearly: number };
}

/**
 * Narrowing with instanceof instead of querySelector<HTMLSelectElement>: the Workers
 * runtime types merge into the global Element and clash with HTMLSelectElement.remove().
 */
export const asSelect = (el: unknown): HTMLSelectElement | null =>
  el instanceof HTMLSelectElement ? el : null;

/** Fills {name} placeholders in the page's data-* strings. */
const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

export function initSlotCheck(): void {
  const check = document.querySelector<HTMLFormElement>('[data-slot-check]');
  const output = document.querySelector<HTMLElement>('[data-availability]');
  if (!check || !output) return;
  const prices = JSON.parse(check.dataset.prices ?? '{}') as Prices;
  const text = check.dataset;
  const usd = new Intl.NumberFormat(text.intl ?? 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  let request = 0;

  const fillCost = (price: { monthly: number; yearly: number }) =>
    fill(text.cost ?? '{monthly} a month or {yearly} a year.', {
      monthly: usd.format(price.monthly),
      yearly: usd.format(price.yearly),
    });

  const sync = (name: string, value: string) => {
    const target = asSelect(document.querySelector(`select[data-sync="${name}"]`));
    if (target) target.value = value;
  };

  const update = async () => {
    const country = asSelect(check.elements.namedItem('country'))?.value ?? '';
    const category = asSelect(check.elements.namedItem('category'))?.value ?? '';
    sync('country', country);
    sync('category', category);
    const price = prices[country];
    for (const el of document.querySelectorAll<HTMLElement>('[data-price]')) {
      const plan = el.dataset.price as 'monthly' | 'yearly';
      el.textContent = price ? `(${usd.format(price[plan])})` : '';
    }
    const current = ++request;
    output.textContent = text.checking ?? 'Checking open places…';
    try {
      const response = await fetch(`/api/slots/?country=${country}&category=${category}`);
      if (!response.ok) throw new Error(String(response.status));
      const { available, total } = (await response.json()) as { available: number; total: number };
      if (current !== request) return;
      const cost = price ? fillCost(price) : '';
      output.textContent =
        available > 0
          ? `${fill(text.open ?? '{available} of {total} places open.', { available, total })} ${cost}`
          : fill(
              text.full ??
                'All {total} places are taken. Choose another category, or write to us to join the waiting list.',
              { total },
            );
    } catch {
      if (current !== request) return;
      const failed = text.unchecked ?? 'Availability could not be checked right now.';
      output.textContent = price
        ? `${failed} ${fill(text.priceLabel ?? 'Price: {cost}', { cost: fillCost(price) })}`
        : failed;
    }
  };

  check.addEventListener('change', () => void update());
  const params = new URLSearchParams(window.location.search);
  for (const name of ['country', 'category']) {
    const value = params.get(name);
    const select = asSelect(check.elements.namedItem(name));
    if (value && select && [...select.options].some((o) => o.value === value)) select.value = value;
  }
  void update();
}
