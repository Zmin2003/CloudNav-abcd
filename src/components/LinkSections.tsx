import React from 'react';
import { Search, Lock } from 'lucide-react';
import { Category, LinkItem } from '../types';
import Icon from './Icon';
import LinkCard from './LinkCard';

interface LinkSectionsProps {
  isSearchPanelOpen: boolean;
  displayedLinks: LinkItem[];
  categories: Category[];
  linksByCategory: Map<string, LinkItem[]>;
  unlockedCategoryIds: Set<string>;
  isAuthenticated: boolean;
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  searchPanelTitle: string;
  searchResultsRef: React.RefObject<HTMLElement | null>;
  onToggleSelection: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
  onRequestUnlock: (category: Category) => void;
}

const LinkGrid: React.FC<{
  links: LinkItem[];
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  onToggleSelection: (id: string) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
}> = ({ links, isBatchEditMode, selectedLinks, onToggleSelection, onContextMenu }) => (
  <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
    {links.map(link => (
      <LinkCard
        key={link.id}
        link={link}
        isBatchEditMode={isBatchEditMode}
        isSelected={selectedLinks.has(link.id)}
        onToggleSelection={onToggleSelection}
        onContextMenu={onContextMenu}
      />
    ))}
  </div>
);

const LinkSections: React.FC<LinkSectionsProps> = ({
  isSearchPanelOpen, displayedLinks, categories, linksByCategory, unlockedCategoryIds, isAuthenticated,
  isBatchEditMode, selectedLinks, searchPanelTitle, searchResultsRef, onToggleSelection, onContextMenu, onRequestUnlock,
}) => {
  if (isSearchPanelOpen) {
    return displayedLinks.length > 0 ? (
      <section ref={searchResultsRef} className="search-results-panel ios-section">
        <div className="flex items-center gap-2 mb-4">
          <Search className="text-[#4285F4]" size={24} />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{searchPanelTitle}</h2>
          <span className="ios-count-badge text-sm px-2 py-0.5 rounded-full">{displayedLinks.length}</span>
        </div>
        <LinkGrid
          links={displayedLinks}
          isBatchEditMode={isBatchEditMode}
          selectedLinks={selectedLinks}
          onToggleSelection={onToggleSelection}
          onContextMenu={onContextMenu}
        />
      </section>
    ) : (
      <section ref={searchResultsRef} className="search-results-panel ios-empty-state py-12 text-center">
        <Search className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
        <p className="text-slate-500 dark:text-slate-400">未找到匹配的链接</p>
      </section>
    );
  }

  return (
    <>
      {categories.map((cat, index) => {
        const catLinks = linksByCategory.get(cat.id) || [];
        const isLocked = !!cat.password && !unlockedCategoryIds.has(cat.id);

        if (catLinks.length === 0 && !isAuthenticated) return null;

        return (
          <section key={cat.id} id={`cat-${cat.id}`} className="fade-up" style={{ animationDelay: `${index * 60}ms` }}>
            <div className="flex items-center gap-2 mb-4 cat-title-line">
              <div className="p-1.5 rounded-lg bg-[#E8F0FE] dark:bg-[#4285F4]/20 text-[#1A73E8] dark:text-[#8AB4F8]">
                <Icon name={cat.icon} size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{cat.name}</h2>
              {isLocked && <Lock size={14} className="text-[#FBBC05]" />}
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{catLinks.length}</span>
            </div>

            {isLocked ? (
              <div className="locked-shimmer flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Lock size={24} className="text-[#FBBC05] mb-2" />
                <p className="text-slate-500 text-sm mb-3">此分类已锁定</p>
                <button
                  onClick={() => onRequestUnlock(cat)}
                  className="px-4 py-1.5 bg-[#FBBC05] text-[#202124] text-xs font-medium rounded-full hover:bg-[#F9AB00] transition-colors"
                >
                  输入密码解锁
                </button>
              </div>
            ) : (
              <LinkGrid
                links={catLinks}
                isBatchEditMode={isBatchEditMode}
                selectedLinks={selectedLinks}
                onToggleSelection={onToggleSelection}
                onContextMenu={onContextMenu}
              />
            )}
          </section>
        );
      })}
    </>
  );
};

export default React.memo(LinkSections);
