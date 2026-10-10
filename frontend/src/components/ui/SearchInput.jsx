import { Search, X } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'Search…', isSearching = false, autoFocus = false }) {
  return (
    <label className="search-input">
      <Search size={16} className="muted" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        maxLength={100}
      />
      {isSearching && <span className="search-input__pulse" aria-hidden />}
      {value && (
        <button type="button" className="icon-button" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </label>
  );
}
