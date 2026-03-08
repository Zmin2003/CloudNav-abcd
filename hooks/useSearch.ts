import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { ExternalSearchSource, SearchMode, SearchConfig } from '../types';

// Debounce hook for search input
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearchQuery: string;

  searchMode: SearchMode;
  externalSearchSources: ExternalSearchSource[];
  selectedSearchSource: ExternalSearchSource | null;
  setSelectedSearchSource: Dispatch<SetStateAction<ExternalSearchSource | null>>;

  showSearchSourcePopup: boolean;
  setShowSearchSourcePopup: (v: boolean) => void;
  hoveredSearchSource: ExternalSearchSource | null;
  setHoveredSearchSource: (s: ExternalSearchSource | null) => void;

  handleSaveSearchConfig: (
    sources: ExternalSearchSource[],
    mode: SearchMode,
    authToken: string,
    selectedSource?: ExternalSearchSource | null,
  ) => Promise<void>;
  handleSearchSourceSelect: (source: ExternalSearchSource, authToken: string) => Promise<void>;
  setSearchMode: (mode: SearchMode) => void;
  setExternalSearchSources: (sources: ExternalSearchSource[]) => void;
}

export function useSearch(): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);

  const [searchMode, setSearchMode] = useState<SearchMode>('internal');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>([]);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);

  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);

  const handleSaveSearchConfig = useCallback(async (
    sources: ExternalSearchSource[],
    mode: SearchMode,
    authToken: string,
    selectedSource?: ExternalSearchSource | null,
  ) => {
    const searchConfig: SearchConfig = {
      mode,
      externalSources: sources,
      selectedSource: selectedSource !== undefined ? selectedSource : null,
    };

    setExternalSearchSources(sources);
    setSearchMode(mode);
    if (selectedSource !== undefined) {
      setSelectedSearchSource(selectedSource);
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['x-auth-password'] = authToken;

      const response = await fetch('/api/storage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ saveConfig: 'search', config: searchConfig }),
      });
      if (!response.ok) {
        console.error('Failed to save search config to KV:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving search config to KV:', error);
    }
  }, []);

  const handleSearchSourceSelect = useCallback(async (
    source: ExternalSearchSource,
    authToken: string,
  ) => {
    setSelectedSearchSource(source);
    await handleSaveSearchConfig(externalSearchSources, searchMode, authToken, source);

    if (searchQuery.trim()) {
      try {
        const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
        const parsed = new URL(searchUrl);
        if (['http:', 'https:'].includes(parsed.protocol)) {
          window.open(searchUrl, '_blank', 'noopener,noreferrer');
        }
      } catch { /* ignore invalid URL */ }
    }
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  }, [externalSearchSources, searchMode, searchQuery, handleSaveSearchConfig]);

  return {
    searchQuery, setSearchQuery, debouncedSearchQuery,
    searchMode, externalSearchSources, selectedSearchSource, setSelectedSearchSource,
    showSearchSourcePopup, setShowSearchSourcePopup,
    hoveredSearchSource, setHoveredSearchSource,
    handleSaveSearchConfig, handleSearchSourceSelect,
    setSearchMode, setExternalSearchSources,
  };
}
