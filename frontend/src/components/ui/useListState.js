import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/** Search box + paging state for list screens. The search is debounced and resets to page 1. */
export function useListState({ pageSize = 15, debounceMs = 350 } = {}) {
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchText.trim(), debounceMs);
  useEffect(() => setPage(1), [debouncedSearch]);
  return {
    searchText,
    setSearchText,
    page,
    setPage,
    isDebouncing: searchText.trim() !== debouncedSearch,
    queryParams: { search: debouncedSearch, page, pageSize },
  };
}
