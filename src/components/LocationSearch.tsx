import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { LocationSelection } from '../domain/types';
import type { SearchState } from '../geocoding/useGeocoding';
import { useI18n } from '../i18n/i18n';

interface LocationSearchProps {
  state: SearchState;
  onSearch(query: string): void;
  onSelect(location: LocationSelection): void;
  onClear(): void;
}

function focusSibling(list: HTMLElement | null, current: Element | null, step: number) {
  if (!list) return;
  const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
  const index = buttons.indexOf(current as HTMLButtonElement);
  const next = buttons[(index + step + buttons.length) % buttons.length];
  next?.focus();
}

export function LocationSearch({ state, onSearch, onSelect, onClear }: LocationSearchProps) {
  const { t } = useI18n();
  const id = useId();
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = state.status === 'success' ? state.results : [];

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      listRef.current?.querySelector('button')?.focus();
    }
    if (event.key === 'Escape') onClear();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusSibling(listRef.current, document.activeElement, event.key === 'ArrowDown' ? 1 : -1);
    }
    if (event.key === 'Escape') {
      onClear();
      inputRef.current?.focus();
    }
  };

  const select = (location: LocationSelection) => {
    onSelect(location);
    onClear();
    inputRef.current?.focus();
  };

  let status = '';
  if (state.status === 'loading') status = t('search.searching');
  if (state.status === 'success') {
    status =
      results.length === 0
        ? t('search.noResults', { query: state.query })
        : results.length === 1
          ? t('search.resultsOne')
          : t('search.resultsMany', { count: results.length });
  }
  if (state.status === 'error') status = t(`search.error.${state.kind}`);

  return (
    <div className="search">
      <form
        className="search__form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(query);
        }}
      >
        <label className="field__label" htmlFor={id}>
          {t('search.label')}
        </label>
        <div className="search__row">
          <input
            ref={inputRef}
            id={id}
            className="input search__input"
            type="search"
            value={query}
            maxLength={200}
            placeholder={t('search.placeholder')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            aria-describedby={`${id}-status`}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={state.status === 'loading' || query.trim().length < 2}
          >
            {state.status === 'loading' ? t('search.searching') : t('search.button')}
          </button>
        </div>
      </form>

      <p
        id={`${id}-status`}
        className={`search__status${state.status === 'error' ? ' search__status--error' : ''}`}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {status}
      </p>

      {results.length > 0 ? (
        <ul
          ref={listRef}
          className="search__results"
          aria-label={t('search.results')}
          onKeyDown={onListKeyDown}
        >
          {results.map((result) => (
            <li key={`${result.latitude},${result.longitude},${result.displayName}`}>
              <button type="button" className="search__result" onClick={() => select(result)}>
                <span className="search__result-name">
                  {result.name || result.city || result.displayName.split(',')[0]}
                </span>
                <span className="search__result-detail">{result.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
