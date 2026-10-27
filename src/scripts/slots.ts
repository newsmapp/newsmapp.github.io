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

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function initSlotCheck(): void {
  const check = document.querySelector<HTMLFormElement>('[data-slot-check]');
  const output = document.querySelector<HTMLElement>('[data-availability]');
  if (!check || !output) return;
  const prices = JSON.parse(check.dataset.prices ?? '{}') as Prices;
  let request = 0;

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
    output.textContent = 'Checking open places…';
    try {
      const response = await fetch(`/api/slots/?country=${country}&category=${category}`);
      if (!response.ok) throw new Error(String(response.status));
      const { available, total } = (await response.json()) as { available: number; total: number };
      if (current !== request) return;
      const cost = price
        ? `${usd.format(price.monthly)} a month or ${usd.format(price.yearly)} a year.`
        : '';
      output.textContent =
        available > 0
          ? `${available} of ${total} places open. ${cost}`
          : `All ${total} places are taken. Choose another category, or write to us to join the waiting list.`;
    } catch {
      if (current !== request) return;
      output.textContent = price
        ? `Availability could not be checked right now. Price: ${usd.format(price.monthly)} a month or ${usd.format(price.yearly)} a year.`
        : 'Availability could not be checked right now.';
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
