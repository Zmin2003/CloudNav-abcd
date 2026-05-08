import React, { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { LinkItem, Category, DEFAULT_CATEGORIES, SearchConfig, PasswordExpiryConfig, AiSortConfig } from './types';
import { createSearchSources, STORAGE_KEYS } from './constants';
import AuthModal from './components/AuthModal';
import ContextMenu from './components/ContextMenu';
import LiquidBackground from './components/LiquidBackground';
import AppHeader from './components/AppHeader';
import SearchSection from './components/SearchSection';
import LinkSections from './components/LinkSections';
import MobileBatchToolbar from './components/MobileBatchToolbar';
import { applySiteConfig } from './utils/favicon';
import { aiSortLinks } from './services/aiSortService';
import { useAppData, ensureProtocol, compareByOrder } from './hooks/useAppData';
import { useSearch } from './hooks/useSearch';
import { useContextMenu } from './hooks/useContextMenu';
import { generateUniqueId, getStatusGreeting } from './utils/appHelpers';

const LinkModal = lazy(() => import('./components/LinkModal'));
const CategoryManagerModal = lazy(() => import('./components/CategoryManagerModal'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const CategoryAuthModal = lazy(() => import('./components/CategoryAuthModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const QRCodeModal = lazy(() => import('./components/QRCodeModal'));

const AUTH_KEY = STORAGE_KEYS.AUTH_TOKEN;
const ModalFallback = () => null;

function App() {
  const appData = useAppData();
  const {
    links, categories, syncStatus, webDavConfig, passwordExpiryConfig, siteConfig, aiSortConfig,
    setLinks, setCategories, setAppDataVersion, setPasswordExpiryConfig, setSiteConfig, setAiSortConfig,
    loadFromLocal, syncToCloud, loadLinkIcons,
    handleSaveWebDavConfig, handleSaveAiSortConfig,
  } = appData;

  const search = useSearch();
  const {
    searchQuery, setSearchQuery, debouncedSearchQuery, searchMode, externalSearchSources, selectedSearchSource, setSelectedSearchSource,
    showSearchSourcePopup, setShowSearchSourcePopup, hoveredSearchSource, setHoveredSearchSource,
    handleSaveSearchConfig, handleSearchSourceSelect, setSearchMode, setExternalSearchSources,
  } = search;

  const ctxMenu = useContextMenu();
  const { contextMenu, qrCodeModal, closeQrCodeModal } = ctxMenu;

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);
  const [editingLink, setEditingLink] = useState<LinkItem | undefined>();
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>();
  const [authToken, setAuthToken] = useState('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [isAiSorting, setIsAiSorting] = useState(false);

  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const searchResultsRef = useRef<HTMLElement | null>(null);
  const isAuthenticated = !!authToken;

  const updateData = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    appData.updateData(newLinks, newCategories, authToken);
  }, [appData.updateData, authToken]);

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    const root = document.documentElement;
    root.classList.toggle('dark', shouldUseDark);
    root.style.colorScheme = shouldUseDark ? 'dark' : 'light';
    root.style.backgroundColor = shouldUseDark ? '#06101d' : '#f8f9fa';

    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setPrefillLink({ title: addTitle, url: addUrl, categoryId: 'common' });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }

    const initData = async () => {
      try {
        const authHeaders: Record<string, string> = savedToken ? { 'x-auth-password': savedToken } : {};
        const authRes = await fetch('/api/storage?checkAuth=true', { headers: authHeaders });
        if (authRes.ok) {
          const authData = await authRes.json();
          setRequiresAuth(authData.requiresAuth);
          if (authData.requiresAuth && !savedToken) { setIsAuthOpen(true); return; }
        }
      } catch (e) { console.warn('Failed to check auth requirement.', e); }

      let hasCloudData = false;
      try {
        const res = await fetch('/api/storage', { headers: savedToken ? { 'x-auth-password': savedToken } : {} });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.links)) {
            setLinks(data.links);
            setCategories(data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify({ links: data.links, categories: data.categories || DEFAULT_CATEGORIES }));
            if (typeof data.version === 'number') setAppDataVersion(data.version);
            loadLinkIcons(data.links, savedToken || '');
            hasCloudData = true;
          }
        } else if (res.status === 401) {
          try {
            const errorData = await res.json();
            if (errorData.error?.includes('过期')) {
              setAuthToken('');
              localStorage.removeItem(AUTH_KEY);
              setIsAuthOpen(true);
              return;
            }
          } catch { /* ignore */ }
        }
      } catch (e) { console.warn('Failed to fetch from cloud, falling back to local.', e); }

      try {
        const [searchConfigRes, websiteConfigRes, siteConfigRes, aiSortConfigRes] = await Promise.all([
          fetch('/api/storage?getConfig=search'),
          fetch('/api/storage?getConfig=website'),
          fetch('/api/storage?getConfig=site'),
          fetch('/api/storage?getConfig=ai'),
        ]);
        if (searchConfigRes.ok) {
          const d = await searchConfigRes.json();
          if (d && (d.mode || d.externalSources || d.selectedSource)) {
            setSearchMode(d.mode || 'internal');
            setExternalSearchSources(d.externalSources || []);
            if (d.selectedSource) setSelectedSearchSource(d.selectedSource);
          }
        }
        if (websiteConfigRes.ok) { const d = await websiteConfigRes.json(); if (d?.passwordExpiry) setPasswordExpiryConfig(d.passwordExpiry); }
        if (siteConfigRes.ok) { const d = await siteConfigRes.json(); if (d) { setSiteConfig(d); applySiteConfig(d); } }
        if (aiSortConfigRes.ok) { const d = await aiSortConfigRes.json(); if (d && (d.apiUrl || d.apiKey || d.model)) setAiSortConfig(d); }
      } catch (e) { console.warn('Failed to fetch configs from KV.', e); }

      if (!hasCloudData) {
        loadFromLocal();
        setSearchMode('internal');
        setExternalSearchSources(createSearchSources());
      }
    };

    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSearchSourcePopup) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && !searchSectionRef.current?.contains(target)) {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearchSourcePopup, setShowSearchSourcePopup, setHoveredSearchSource]);

  const toggleBatchEditMode = useCallback(() => {
    setIsBatchEditMode(prev => !prev);
    setSelectedLinks(new Set());
  }, []);

  const toggleLinkSelection = useCallback((linkId: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      next.has(linkId) ? next.delete(linkId) : next.add(linkId);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, link: LinkItem) => {
    ctxMenu.handleContextMenu(event, link, isBatchEditMode);
  }, [ctxMenu.handleContextMenu, isBatchEditMode]);

  const handleLogin = useCallback(async (password: string): Promise<boolean> => {
    try {
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': password },
        body: JSON.stringify({ authOnly: true }),
      });
      if (!authResponse.ok) return false;
      setAuthToken(password);
      localStorage.setItem(AUTH_KEY, password);
      setIsAuthOpen(false);
      localStorage.setItem('lastLoginTime', Date.now().toString());
      try {
        const res = await fetch('/api/storage', { headers: { 'x-auth-password': password } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.links)) {
            const nextCategories = Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : DEFAULT_CATEGORIES;
            setLinks(data.links);
            setCategories(nextCategories);
            localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify({ links: data.links, categories: nextCategories }));
            loadLinkIcons(data.links, password);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch data after login.', e);
        loadFromLocal();
        syncToCloud(links, categories, password);
      }
      return true;
    } catch { return false; }
  }, [links, categories, setLinks, setCategories, loadLinkIcons, syncToCloud, loadFromLocal]);

  const handleCategoryActionAuth = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': password },
        body: JSON.stringify({ authOnly: true }),
      });
      return res.ok;
    } catch { return false; }
  }, []);

  const handleAddLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    const newLink: LinkItem = {
      ...data,
      url: ensureProtocol(data.url),
      id: generateUniqueId(),
      createdAt: Date.now(),
      pinnedOrder: data.pinned ? links.filter(l => l.pinned).length : undefined,
    };
    const updatedLinks = newLink.pinned
      ? (() => {
        const firstNonPinnedIndex = links.findIndex(link => !link.pinned);
        if (firstNonPinnedIndex === -1) return [...links, newLink];
        const copy = [...links];
        copy.splice(firstNonPinnedIndex, 0, newLink);
        return copy;
      })()
      : [...links, newLink].sort((a, b) => (a.pinned && !b.pinned ? -1 : !a.pinned && b.pinned ? 1 : compareByOrder(a, b)));
    updateData(updatedLinks, categories);
    setPrefillLink(undefined);
  }, [authToken, links, categories, updateData]);

  const handleEditLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;
    updateData(links.map(l => l.id === editingLink.id ? { ...l, ...data, url: ensureProtocol(data.url) } : l), categories);
    setEditingLink(undefined);
  }, [authToken, editingLink, links, categories, updateData]);

  const handleDeleteLink = useCallback((id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) updateData(links.filter(l => l.id !== id), categories);
  }, [authToken, links, categories, updateData]);

  const handleBatchDelete = useCallback(() => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (selectedLinks.size === 0) { alert('请先选择要删除的链接'); return; }
    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      updateData(links.filter(link => !selectedLinks.has(link.id)), categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  }, [authToken, selectedLinks, links, categories, updateData]);

  const handleImportConfirm = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    const mergedCategories = [...categories];
    if (!mergedCategories.some(c => c.id === 'common')) mergedCategories.push({ id: 'common', name: '常用推荐', icon: 'Star' });
    newCategories.forEach(nc => {
      if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) mergedCategories.push(nc);
    });
    updateData([...links, ...newLinks], mergedCategories);
    setIsImportModalOpen(false);
    alert(`成功导入 ${newLinks.length} 个新书签!`);
  }, [links, categories, updateData]);

  const handleAiSort = useCallback(async () => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!aiSortConfig.apiUrl || !aiSortConfig.apiKey || !aiSortConfig.model) { alert('请先在设置 → AI 排序中配置 API 地址、Key 和模型'); return; }
    if (links.length === 0) { alert('没有书签可以整理'); return; }
    if (!confirm(`将使用 AI 对 ${links.length} 个书签进行智能分类和排序，常用推荐分类的书签不会被移动。是否继续？`)) return;
    setIsAiSorting(true);
    try {
      const result = await aiSortLinks(links, categories, aiSortConfig, authToken);
      updateData(result.links, result.categories);
      alert(result.newCategoriesCreated.length > 0 ? `AI 整理完成！新建了 ${result.newCategoriesCreated.length} 个分类：${result.newCategoriesCreated.join('、')}` : 'AI 整理完成！书签已重新分类和排序。');
    } catch (error: any) {
      alert(`AI 整理失败：${error.message || '未知错误'}`);
      console.error('AI sort error:', error);
    } finally { setIsAiSorting(false); }
  }, [authToken, aiSortConfig, links, categories, updateData]);

  const handleUpdateCategories = useCallback((newCats: Category[]) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    updateData(links, newCats);
  }, [authToken, links, updateData]);

  const handleDeleteCategory = useCallback((catId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (catId === 'common') { alert('常用推荐分类不能被删除'); return; }
    let newCats = categories.filter(c => c.id !== catId);
    if (!newCats.some(c => c.id === 'common')) newCats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...newCats];
    updateData(links.map(l => l.categoryId === catId ? { ...l, categoryId: 'common' } : l), newCats);
  }, [authToken, categories, links, updateData]);

  const normalizedSearchQuery = useDeferredValue(debouncedSearchQuery.trim().toLowerCase());
  const isCategoryLocked = useCallback((catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return !!cat?.password && !unlockedCategoryIds.has(catId);
  }, [categories, unlockedCategoryIds]);

  const displayedLinks = useMemo(() => {
    let result = links.filter(l => !isCategoryLocked(l.categoryId));
    if (normalizedSearchQuery) {
      const q = normalizedSearchQuery;
      result = result.filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || !!l.description?.toLowerCase().includes(q));
    }
    return result.slice().sort(compareByOrder);
  }, [links, normalizedSearchQuery, isCategoryLocked]);

  const linksByCategory = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    categories.forEach(cat => map.set(cat.id, []));
    links.forEach(link => map.get(link.categoryId)?.push(link));
    map.forEach(bucket => bucket.sort(compareByOrder));
    return map;
  }, [links, categories]);

  const enabledSearchSources = useMemo(() => externalSearchSources.filter(source => source.enabled), [externalSearchSources]);
  const greeting = useMemo(() => getStatusGreeting(), []);
  const isSearchPanelOpen = isSearchFocused || normalizedSearchQuery.length > 0;
  const searchPanelTitle = normalizedSearchQuery.length > 0 ? '搜索结果' : '全部链接';

  useEffect(() => {
    if (!isSearchPanelOpen) return;
    const frame = window.requestAnimationFrame(() => searchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [isSearchPanelOpen]);

  const currentLinkIds = displayedLinks.map(link => link.id);
  const allSelected = currentLinkIds.length > 0 && selectedLinks.size === currentLinkIds.length && currentLinkIds.every(id => selectedLinks.has(id));
  const handleSelectAll = () => setSelectedLinks(allSelected ? new Set() : new Set(currentLinkIds));

  const requireAuthOr = (action: () => void) => { if (!authToken) setIsAuthOpen(true); else action(); };
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="app-shell relative w-full">
      <LiquidBackground enabled={siteConfig.liquidBackgroundEnabled !== false} />
      <div className="app-viewport flex overflow-hidden text-slate-900 dark:text-slate-50 relative z-10 w-full">
        {requiresAuth && !authToken && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
            <div className="w-full max-w-md p-6">
              <AuthModal isOpen={true} onLogin={handleLogin} />
            </div>
          </div>
        )}

        {(!requiresAuth || authToken) && (
          <>
            <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />

            <Suspense fallback={<ModalFallback />}>
              {!!catAuthModalData && (
                <CategoryAuthModal isOpen={!!catAuthModalData} category={catAuthModalData} onClose={() => setCatAuthModalData(null)} onUnlock={(catId) => { setUnlockedCategoryIds(prev => new Set(prev).add(catId)); setSelectedCategory(catId); }} />
              )}
              {isCatManagerOpen && <CategoryManagerModal isOpen={isCatManagerOpen} onClose={() => setIsCatManagerOpen(false)} categories={categories} onUpdateCategories={handleUpdateCategories} onDeleteCategory={handleDeleteCategory} onVerifyPassword={handleCategoryActionAuth} />}
              {isBackupModalOpen && <BackupModal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} authToken={authToken} links={links} categories={categories} onRestore={(restoredLinks, restoredCategories) => { updateData(restoredLinks, restoredCategories); setIsBackupModalOpen(false); }} webDavConfig={webDavConfig} onSaveWebDavConfig={handleSaveWebDavConfig} searchConfig={{ mode: searchMode, externalSources: externalSearchSources }} onRestoreSearchConfig={(config: SearchConfig) => handleSaveSearchConfig(config.externalSources, config.mode, authToken)} />}
              {isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} existingLinks={links} categories={categories} onImport={handleImportConfirm} onImportSearchConfig={(config: SearchConfig) => handleSaveSearchConfig(config.externalSources, config.mode, authToken)} />}
              {isSettingsModalOpen && <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} passwordExpiryConfig={passwordExpiryConfig} onSavePasswordExpiry={(config: PasswordExpiryConfig) => appData.handleSavePasswordExpiryConfig(config, authToken)} siteConfig={siteConfig} onSaveSiteConfig={(config: any) => appData.handleSaveSiteConfig(config, authToken)} aiSortConfig={aiSortConfig} onSaveAiSortConfig={(config: AiSortConfig) => handleSaveAiSortConfig(config, authToken)} />}
            </Suspense>

            <main className="glass-app-bg app-main flex-1 flex flex-col h-full overflow-y-auto relative w-full">
              <AppHeader
                navigationName={siteConfig.navigationName}
                syncStatus={syncStatus}
                isBatchEditMode={isBatchEditMode}
                isAiSorting={isAiSorting}
                isMobileMenuOpen={isMobileMenuOpen}
                onOpenSettings={() => { setIsSettingsModalOpen(true); closeMobileMenu(); }}
                onAddLink={() => requireAuthOr(() => { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); })}
                onImport={() => { requireAuthOr(() => setIsImportModalOpen(true)); closeMobileMenu(); }}
                onBackup={() => { requireAuthOr(() => setIsBackupModalOpen(true)); closeMobileMenu(); }}
                onManageCategories={() => { requireAuthOr(() => setIsCatManagerOpen(true)); closeMobileMenu(); }}
                onToggleBatchEdit={() => { toggleBatchEditMode(); closeMobileMenu(); }}
                onAiSort={() => { handleAiSort(); closeMobileMenu(); }}
                onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
              />

              <div className="relative isolate flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-8 space-y-6 sm:space-y-8 scroll-smooth">
                <SearchSection
                  greeting={greeting}
                  isSearchPanelOpen={isSearchPanelOpen}
                  showSearchSourcePopup={showSearchSourcePopup}
                  searchSectionRef={searchSectionRef}
                  enabledSearchSources={enabledSearchSources}
                  hoveredSearchSource={hoveredSearchSource}
                  selectedSearchSource={selectedSearchSource}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setIsSearchFocused={setIsSearchFocused}
                  setShowSearchSourcePopup={setShowSearchSourcePopup}
                  setHoveredSearchSource={setHoveredSearchSource}
                  onSearchSourceSelect={(source) => handleSearchSourceSelect(source, authToken)}
                />

                <LinkSections
                  isSearchPanelOpen={isSearchPanelOpen}
                  displayedLinks={displayedLinks}
                  categories={categories}
                  linksByCategory={linksByCategory}
                  unlockedCategoryIds={unlockedCategoryIds}
                  isAuthenticated={isAuthenticated}
                  isBatchEditMode={isBatchEditMode}
                  selectedLinks={selectedLinks}
                  searchPanelTitle={searchPanelTitle}
                  searchResultsRef={searchResultsRef}
                  onToggleSelection={toggleLinkSelection}
                  onContextMenu={handleContextMenu}
                  onRequestUnlock={setCatAuthModalData}
                />
              </div>
            </main>

            <Suspense fallback={<ModalFallback />}>
              {isModalOpen && <LinkModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }} onSave={editingLink ? handleEditLink : handleAddLink} onDelete={editingLink ? handleDeleteLink : undefined} categories={categories} initialData={editingLink || (prefillLink as LinkItem)} defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined} />}
            </Suspense>

            <button onClick={() => requireAuthOr(() => { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); })} className="sm:hidden fixed right-4 bottom-4 z-30 w-14 h-14 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] active:scale-90 text-white rounded-full shadow-md flex items-center justify-center transition-all duration-200 safe-area-bottom" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <Plus size={24} />
            </button>

            <MobileBatchToolbar visible={isBatchEditMode} selectedCount={selectedLinks.size} allSelected={allSelected} onSelectAll={handleSelectAll} onDelete={handleBatchDelete} onDone={toggleBatchEditMode} />

            <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} onClose={ctxMenu.closeContextMenu} onCopyLink={ctxMenu.copyLinkToClipboard} onShowQRCode={ctxMenu.showQRCode} onEditLink={() => ctxMenu.editLinkFromContextMenu((link) => { setEditingLink(link); setIsModalOpen(true); })} onDeleteLink={() => ctxMenu.deleteLinkFromContextMenu((link) => updateData(links.filter(l => l.id !== link.id), categories))} onTogglePin={() => ctxMenu.togglePinFromContextMenu(links, (updated) => updateData(updated, categories))} />

            <Suspense fallback={<ModalFallback />}>
              {qrCodeModal.isOpen && <QRCodeModal isOpen={qrCodeModal.isOpen} url={qrCodeModal.url || ''} title={qrCodeModal.title || ''} onClose={closeQrCodeModal} />}
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
