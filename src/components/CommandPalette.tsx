import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

interface PagefindResult {
  url: string;
  meta: { title?: string };
  excerpt: string;
  filters: { type?: string[] };
}

interface Pagefind {
  search: (query: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }>;
  init?: () => Promise<void>;
}

interface Hit {
  url: string;
  title: string;
  type: string;
}

const TYPE_LABEL: Record<string, string> = {
  country: 'Country',
  category: 'Category',
  outlet: 'Outlet',
  continent: 'Continent',
  page: 'Page',
};

let pagefindPromise: Promise<Pagefind> | null = null;
function loadPagefind(): Promise<Pagefind> {
  // The index only exists after `pnpm build`; the path is kept opaque to the bundler.
  const path = '/pagefind/pagefind.js';
  pagefindPromise ??= import(/* @vite-ignore */ path) as Promise<Pagefind>;
  return pagefindPromise;
}

/** ⌘K / Ctrl+K search over countries, categories and outlets (Pagefind, loaded on first open). */
export default function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const open = useCallback(() => {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    input.current?.select();
    loadPagefind().catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('[data-open-search]')) open();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    loadPagefind()
      .then((pagefind) => pagefind.search(term))
      .then((search) => Promise.all(search.results.slice(0, 8).map((r) => r.data())))
      .then((data) => {
        if (cancelled) return;
        setHits(
          data.map((d) => ({
            url: d.url,
            title: d.meta.title ?? d.url,
            type: TYPE_LABEL[d.filters.type?.[0] ?? 'page'] ?? 'Page',
          })),
        );
        setActive(0);
        setStatus('idle');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && hits[active]) {
      event.preventDefault();
      window.location.assign(hits[active].url);
    }
  };

  const term = query.trim();
  return (
    <dialog
      ref={dialog}
      class="palette"
      aria-label="Search"
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
    >
      <div class="palette-box">
        <label class="visually-hidden" for="palette-input">
          Search countries, categories and outlets
        </label>
        <input
          ref={input}
          id="palette-input"
          type="search"
          autoComplete="off"
          spellcheck={false}
          placeholder="Search countries, categories and outlets…"
          value={query}
          onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="palette-results"
          aria-activedescendant={hits[active] ? `palette-hit-${active}` : undefined}
        />
        <ul id="palette-results" role="listbox" class="palette-results">
          {hits.map((hit, index) => (
            <li
              key={hit.url}
              id={`palette-hit-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseMove={() => setActive(index)}
            >
              <a href={hit.url}>
                <span class="palette-title">{hit.title}</span>
                <span class="palette-type">{hit.type}</span>
              </a>
            </li>
          ))}
        </ul>
        <p class="palette-status" role="status">
          {status === 'error'
            ? 'Search is unavailable right now. Browse by country from the home page.'
            : status === 'loading'
              ? 'Searching…'
              : term.length >= 2 && hits.length === 0
                ? `No countries or outlets match “${term}”.`
                : ''}
        </p>
      </div>
    </dialog>
  );
}
