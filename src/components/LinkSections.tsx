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
  <div className="link-grid grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
      <section ref={searchResultsRef} className="layout-category-section search-results-panel ios-section">
        <div className="category-heading flex items-center gap-3 mb-5 sm:mb-6">
          <Search className="text-[#6f9448] dark:text-[#b7dc8e]" size={24} />
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">{searchPanelTitle}</h2>
          <span className="ios-count-badge text-xs px-2.5 py-1 rounded-full">{displayedLinks.length}</span>
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
      <section ref={searchResultsRef} className="layout-category-section search-results-panel ios-empty-state py-16 text-center">
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
          <section key={cat.id} id={`cat-${cat.id}`} className="layout-category-section ios-section fade-up" style={{ animationDelay: `${index * 60}ms` }}>
            <div className="category-heading flex items-center gap-3 mb-5 sm:mb-6 cat-title-line">
              <div className="category-icon-shell p-2 rounded-2xl bg-[#eef6df] dark:bg-[#b7dc8e]/15 text-[#6f9448] dark:text-[#b7dc8e]">
                <Icon name={cat.icon} size={18} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">{cat.name}</h2>
              {isLocked && <Lock size={14} className="text-[#d59c42] dark:text-[#e5c27c]" />}
              <span className="ios-count-badge text-xs px-2.5 py-1 rounded-full">{catLinks.length}</span>
            </div>

            {isLocked ? (
              <div className="locked-shimmer flex flex-col items-center justify-center py-12 rounded-3xl border border-dashed">
                <Lock size={24} className="text-[#d59c42] dark:text-[#e5c27c] mb-2" />
                <p className="text-slate-500 text-sm mb-3">此分类已锁定</p>
                <button
                  onClick={() => onRequestUnlock(cat)}
                  className="ios-primary-btn btn-pop px-5 py-2 text-xs rounded-full transition-colors"
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
