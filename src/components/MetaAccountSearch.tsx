'use client';

import { Search, X } from 'lucide-react';

type MetaAccountSearchProps = {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
};

export function MetaAccountSearch({ label, placeholder, query, onQueryChange }: MetaAccountSearchProps) {
  return (
    <div className="relative mb-6">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
      />
      <input
        aria-label={label}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border-2 border-border-custom bg-card py-3.5 pl-12 pr-12 text-foreground outline-none transition-colors placeholder:text-muted focus:border-blue-500"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onQueryChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition-colors hover:bg-accent-custom hover:text-foreground"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

