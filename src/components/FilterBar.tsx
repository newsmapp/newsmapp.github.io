import { useEffect, useMemo, useState } from 'preact/hooks';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  paywalls: FilterOption[];
  ownership: FilterOption[];
  formats: FilterOption[];
  total: number;
}

interface Filters {
  paywall: string;
  ownership: string;
  format: string;
  q: string;
}

const KEYS = ['paywall', 'ownership', 'format', 'q'] as const;

function readUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  return {
    paywall: params.get('paywall') ?? '',
    ownership: params.get('ownership') ?? '',
    format: params.get('format') ?? '',
    q: params.get('q') ?? '',
  };
}

/** Applies filters to the server-rendered rows; returns how many outlets remain visible. */
function apply(filters: Filters): number {
  const term = filters.q.trim().toLowerCase();
  const visible = new Set<string>();
  for (const column of document.querySelectorAll<HTMLElement>('[data-column]')) {
    let shown = 0;
    for (const row of column.querySelectorAll<HTMLElement>('[data-outlet-row]')) {
      const match =
        (!filters.paywall || row.dataset.paywall === filters.paywall) &&
        (!filters.ownership || row.dataset.ownership === filters.ownership) &&
        (!filters.format || row.dataset.format === filters.format) &&
        (!term || (row.dataset.name ?? '').includes(term));
      row.hidden = !match;
      if (match) {
        shown += 1;
        const link = row.querySelector<HTMLElement>('[data-track]');
        if (link?.dataset.track) visible.add(link.dataset.track);
      }
    }
    const count = column.querySelector<HTMLElement>('[data-count]');
    if (count) count.textContent = String(shown);
    const empty = column.querySelector<HTMLElement>('[data-empty]');
    if (empty) empty.hidden = shown > 0;
    // Reveal rows hidden behind "Show all" while filtering, so matches are never out of sight.
    const more = column.querySelector<HTMLDetailsElement>('details');
    if (more && isFiltering(filters)) more.open = true;
  }
  return visible.size;
}

const isFiltering = (filters: Filters): boolean => KEYS.some((key) => filters[key] !== '');

export default function FilterBar({ paywalls, ownership, formats, total }: Props) {
  const [filters, setFilters] = useState<Filters>({
    paywall: '',
    ownership: '',
    format: '',
    q: '',
  });
  const [shown, setShown] = useState(total);

  useEffect(() => {
    setFilters(readUrl());
  }, []);

  useEffect(() => {
    setShown(apply(filters));
    const params = new URLSearchParams(window.location.search);
    for (const key of KEYS) {
      if (filters[key]) params.set(key, filters[key]);
      else params.delete(key);
    }
    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }, [filters]);

  const update = (key: keyof Filters) => (event: Event) =>
    setFilters((current) => ({ ...current, [key]: (event.target as HTMLInputElement).value }));

  const selects = useMemo(
    () =>
      [
        { key: 'paywall', label: 'Paywall', any: 'Any access', options: paywalls },
        { key: 'ownership', label: 'Ownership', any: 'Any ownership', options: ownership },
        { key: 'format', label: 'Format', any: 'Any format', options: formats },
      ] as const,
    [paywalls, ownership, formats],
  );

  return (
    <form
      class="filters"
      role="search"
      aria-label="Filter outlets"
      onSubmit={(event) => event.preventDefault()}
    >
      {selects.map((select) => (
        <label class="filter" key={select.key}>
          <span class="filter-label">{select.label}</span>
          <select name={select.key} value={filters[select.key]} onChange={update(select.key)}>
            <option value="">{select.any}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label class="filter filter-text">
        <span class="filter-label">Name</span>
        <input
          type="search"
          name="q"
          placeholder="Filter by name…"
          autoComplete="off"
          spellcheck={false}
          value={filters.q}
          onInput={update('q')}
        />
      </label>
      <p class="filter-result" role="status" aria-live="polite">
        {isFiltering(filters) ? `${shown} of ${total} outlets shown` : `${total} outlets`}
      </p>
      {isFiltering(filters) && (
        <button
          type="button"
          class="filter-reset"
          onClick={() => setFilters({ paywall: '', ownership: '', format: '', q: '' })}
        >
          Clear filters
        </button>
      )}
    </form>
  );
}
