import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { ExternalSearchSource, SearchMode, SearchConfig } from '../types';
import { createSearchSources } from '../constants';

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
  isIconHovered: boolean;
  setIsIconHovered: (v: boolean) => void;
  isPopupHovered: boolean;
  setIsPopupHovered: (v: boolean) => void;

  handleSaveSearchConfig: (
    sources: ExternalSearchSource[],
    mode: SearchMode,
    authToken: string,
    selectedSource?: ExternalSearchSource | null,
  ) => Promise<void>;
  handleSearchModeChange: (mode: SearchMode, authToken: string) => void;
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
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isIconHovered, isPopupHovered]);

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

  const handleSearchModeChange = useCallback((mode: SearchMode, authToken: string) => {
    setSearchMode(mode);
    if (mode === 'external' && externalSearchSources.length === 0) {
      const defaultSources = createSearchSources();
      handleSaveSearchConfig(defaultSources, mode, authToken);
    } else {
      handleSaveSearchConfig(externalSearchSources, mode, authToken);
    }
  }, [externalSearchSources, handleSaveSearchConfig]);

  const handleSearchSourceSelect = useCallback(async (
    source: ExternalSearchSource,
    authToken: string,
  ) => {
    setSelectedSearchSource(source);
    await handleSaveSearchConfig(externalSearchSources, searchMode, authToken, source);

    if (searchQuery.trim()) {
      const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
      window.open(searchUrl, '_blank');
    }
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  }, [externalSearchSources, searchMode, searchQuery, handleSaveSearchConfig]);

  return {
    searchQuery, setSearchQuery, debouncedSearchQuery,
    searchMode, externalSearchSources, selectedSearchSource, setSelectedSearchSource,
    showSearchSourcePopup, setShowSearchSourcePopup,
    hoveredSearchSource, setHoveredSearchSource,
    isIconHovered, setIsIconHovered,
    isPopupHovered, setIsPopupHovered,
    handleSaveSearchConfig, handleSearchModeChange, handleSearchSourceSelect,
    setSearchMode, setExternalSearchSources,
  };
}
