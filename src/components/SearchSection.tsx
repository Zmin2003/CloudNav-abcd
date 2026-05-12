import React, { startTransition } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { safeHostname } from '../hooks/useAppData';
import { openSafeUrl } from '../utils/appHelpers';

interface SearchSectionProps {
  greeting: string;
  isSearchPanelOpen: boolean;
  showSearchSourcePopup: boolean;
  searchSectionRef: React.RefObject<HTMLDivElement | null>;
  enabledSearchSources: any[];
  hoveredSearchSource: any;
  selectedSearchSource: any;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setIsSearchFocused: (value: boolean) => void;
  setShowSearchSourcePopup: (value: boolean) => void;
  setHoveredSearchSource: (source: any) => void;
  onSearchSourceSelect: (source: any) => void;
}

const SearchSection: React.FC<SearchSectionProps> = ({
  greeting, isSearchPanelOpen, showSearchSourcePopup, searchSectionRef, enabledSearchSources,
  hoveredSearchSource, selectedSearchSource, searchQuery, setSearchQuery, setIsSearchFocused,
  setShowSearchSourcePopup, setHoveredSearchSource, onSearchSourceSelect,
}) => {
  const activeSearchSource = hoveredSearchSource || selectedSearchSource;
  const activeSearchHostname = activeSearchSource ? safeHostname(activeSearchSource.url) : '';

  const openSearch = () => {
    if (!selectedSearchSource || !searchQuery.trim()) return;
    const searchUrl = selectedSearchSource.url.replace('{query}', encodeURIComponent(searchQuery));
    openSafeUrl(searchUrl);
  };

  return (
    <section className={`hero-search-section relative flex flex-col items-center justify-center fade-up ${
      isSearchPanelOpen ? 'pt-5 pb-2 sm:pt-8 sm:pb-4 md:pt-10 md:pb-6' : 'pt-[10vh] pb-6 sm:py-14 md:py-24'
    } ${showSearchSourcePopup ? 'z-[60]' : 'z-0'}`}>
      <h1 className="hero-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-3 sm:mb-4 gradient-shimmer drop-shadow-sm">{greeting}</h1>
      <p className="hero-subtitle mb-6 sm:mb-8 max-w-2xl text-center text-sm sm:text-base md:text-lg text-slate-500 dark:text-slate-300">以更清爽的抹茶色设计整理常用链接，搜索、收藏和管理都更顺手。</p>

      <div
        ref={searchSectionRef}
        className={`ios-search-shell relative isolate w-full max-w-4xl mx-auto rounded-[2rem] sm:rounded-full group search-glow search-focus-ring transition-all duration-300 hover:-translate-y-1 ${
          showSearchSourcePopup ? 'z-[70] shadow-2xl' : 'z-10 shadow-2xl'
        }`}
      >
        {showSearchSourcePopup && (
          <div className="absolute left-0 top-full mt-3 w-full ios-popover rounded-3xl p-4 z-[80] scale-in">
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3">
              {enabledSearchSources.map((source, index) => {
                const hostname = safeHostname(source.url);
                return (
                  <button
                    key={source.id || index}
                    onClick={() => onSearchSourceSelect(source)}
                    onMouseEnter={() => setHoveredSearchSource(source)}
                    onMouseLeave={() => setHoveredSearchSource(null)}
                    className="ios-source-item flex flex-col items-center gap-2 p-3 rounded-2xl transition-all group/item hover:-translate-y-1"
                  >
                    <div className="ios-source-icon p-2 rounded-xl group-hover/item:scale-110 transition-transform">
                      {hostname ? (
                        <img
                          src={`https://www.faviconextractor.com/favicon/${hostname}?larger=true`}
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`; }}
                          alt={source.name}
                          loading="lazy"
                          decoding="async"
                          className="w-5 h-5 object-contain bg-transparent"
                        />
                      ) : <Search size={20} className="text-slate-400" />}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-100 truncate w-full text-center">{source.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          className="ios-search-trigger absolute left-5 top-1/2 -translate-y-1/2 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
          onClick={() => {
            setShowSearchSourcePopup(!showSearchSourcePopup);
            if (showSearchSourcePopup) setHoveredSearchSource(null);
          }}
          title="切换搜索引擎"
        >
          {activeSearchSource && activeSearchHostname ? (
            <img
              src={`https://www.faviconextractor.com/favicon/${activeSearchHostname}?larger=true`}
              alt={activeSearchSource.name}
              loading="lazy"
              decoding="async"
              className="w-7 h-7 object-contain bg-transparent hover:scale-110 transition-transform"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${activeSearchHostname}&sz=32`; }}
            />
          ) : <Search size={22} className="text-slate-500 transition-colors" />}
        </button>

        <input
          type="text"
          placeholder={selectedSearchSource ? `在 ${selectedSearchSource.name} 搜索...` : '输入搜索内容...'}
          value={searchQuery}
          onChange={(e) => { const value = e.target.value; startTransition(() => setSearchQuery(value)); }}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => {
            window.requestAnimationFrame(() => {
              const activeElement = document.activeElement;
              if (!searchSectionRef.current?.contains(activeElement) && !searchQuery.trim()) setIsSearchFocused(false);
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') openSearch();
            else if (e.key === 'Escape' && !searchQuery.trim()) {
              setIsSearchFocused(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="ios-search-input w-full pl-16 pr-16 py-5 sm:py-5 rounded-[2rem] sm:rounded-full text-base sm:text-lg dark:text-white outline-none transition-colors"
        />

        {searchQuery.trim() && (
          <button onClick={openSearch} className="ios-search-submit absolute right-5 top-1/2 -translate-y-1/2 p-2.5 text-white rounded-full transition-colors shadow-sm">
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
};

export default React.memo(SearchSection);
