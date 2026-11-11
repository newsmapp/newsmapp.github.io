import { useEffect, useMemo, useState } from 'preact/hooks';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterLabels {
  form: string;
  paywall: string;
  anyPaywall: string;
  ownership: string;
  anyOwnership: string;
  format: string;
  anyFormat: string;
  name: string;
  namePlaceholder: string;
  clear: string;
  result: string;
  resultAll: string;
}

interface Props {
  paywalls: FilterOption[];
  ownership: FilterOption[];
  formats: FilterOption[];
  total: number;
  labels: FilterLabels;
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
        if (row.dataset.outlet) visible.add(row.dataset.outlet);
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

const fill = (template: string, values: Record<string, number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));

export default function FilterBar({ paywalls, ownership, formats, total, labels }: Props) {
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
        { key: 'paywall', label: labels.paywall, any: labels.anyPaywall, options: paywalls },
        {
          key: 'ownership',
          label: labels.ownership,
          any: labels.anyOwnership,
          options: ownership,
        },
        { key: 'format', label: labels.format, any: labels.anyFormat, options: formats },
      ] as const,
    [paywalls, ownership, formats, labels],
  );

  return (
    <form
      class="filters"
      role="search"
      aria-label={labels.form}
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
        <span class="filter-label">{labels.name}</span>
        <input
          type="search"
          name="q"
          placeholder={labels.namePlaceholder}
          autoComplete="off"
          spellcheck={false}
          value={filters.q}
          onInput={update('q')}
        />
      </label>
      <p class="filter-result" role="status" aria-live="polite">
        {isFiltering(filters)
          ? fill(labels.result, { shown, total })
          : fill(labels.resultAll, { total })}
      </p>
      {isFiltering(filters) && (
        <button
          type="button"
          class="filter-reset"
          onClick={() => setFilters({ paywall: '', ownership: '', format: '', q: '' })}
        >
          {labels.clear}
        </button>
      )}
    </form>
  );
}
