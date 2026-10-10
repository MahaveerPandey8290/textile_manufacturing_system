import { Boxes, Building2, ScrollText, ShoppingBag, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiQuery } from '../../hooks/useApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SearchInput } from '../ui/SearchInput';

const RESULT_ICONS = { order: ShoppingBag, roll: ScrollText, buyer: Building2, yarn: Boxes, worker: User };
const RESULT_ROUTES = {
  order: (id) => `/orders/${id}`,
  roll: (id) => `/quality?roll=${id}`,
  buyer: () => '/parties',
  yarn: () => '/inventory',
  worker: () => '/workforce',
};

/**
 * Command-bar search. Typing is debounced (350 ms) so we send one request when the user pauses,
 * and React Query aborts the previous request if a newer term arrives while it is still running.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedTerm = useDebouncedValue(searchText.trim(), 350);
  const canSearch = debouncedTerm.length >= 2;
  const { data: results, isFetching, error } = useApiQuery('/search', { q: debouncedTerm }, { enabled: canSearch, staleTime: 30_000 });

  useEffect(() => {
    const closeOnOutsideClick = (event) => !containerRef.current?.contains(event.target) && setIsOpen(false);
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const openResult = (result) => {
    navigate(RESULT_ROUTES[result.kind](result.id));
    setIsOpen(false);
    setSearchText('');
  };

  return (
    <div className="global-search" ref={containerRef} onFocus={() => setIsOpen(true)}>
      <SearchInput
        value={searchText}
        onChange={setSearchText}
        placeholder="Search orders, rolls, buyers, yarn…"
        isSearching={isFetching || searchText.trim() !== debouncedTerm}
      />
      {isOpen && canSearch && (
        <div className="global-search__results">
          {error && <div className="global-search__empty">{error.message}</div>}
          {!error && results?.length === 0 && <div className="global-search__empty">No matches for “{debouncedTerm}”</div>}
          {results?.map((result) => {
            const Icon = RESULT_ICONS[result.kind];
            return (
              <button key={`${result.kind}-${result.id}`} className="global-search__item" onClick={() => openResult(result)}>
                <Icon size={16} />
                <span className="global-search__title">{result.title}</span>
                <span className="global-search__subtitle">{result.subtitle}</span>
                <span className="global-search__kind">{result.kind}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
