
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Search, Plus, Settings, Upload, ArrowRight, Lock, Menu, X, Trash2, FolderInput, CheckSquare, Bot, Loader2 } from 'lucide-react';
import { LinkItem, Category, DEFAULT_CATEGORIES, SearchMode, SearchConfig, PasswordExpiryConfig, AiSortConfig } from './types';
import { createSearchSources, STORAGE_KEYS } from './constants';
import Icon from './components/Icon';
import AuthModal from './components/AuthModal';
import ContextMenu from './components/ContextMenu';
import LinkCard from './components/LinkCard';
import { applySiteConfig } from './utils/favicon';
import SakuraBackground from './components/SakuraBackground';
import { aiSortLinks } from './services/aiSortService';
import { useAppData, safeHostname, ensureProtocol, compareByOrder } from './hooks/useAppData';
import { useSearch } from './hooks/useSearch';
import { useContextMenu } from './hooks/useContextMenu';

// Lazy-loaded modals (code-splitting: only loaded when opened)
const LinkModal = lazy(() => import('./components/LinkModal'));
const CategoryManagerModal = lazy(() => import('./components/CategoryManagerModal'));
const BackupModal = lazy(() => import('./components/BackupModal'));
const CategoryAuthModal = lazy(() => import('./components/CategoryAuthModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const QRCodeModal = lazy(() => import('./components/QRCodeModal'));

const AUTH_KEY = STORAGE_KEYS.AUTH_TOKEN;

// Suspense fallback for lazy-loaded modals
const ModalFallback = () => null;

// Time Greeting (pure function, no need to be inside component)
function getStatusGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '夜深了，注意休息';
  if (hour < 9) return '早安，新的一天';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了，早点休息';
}

function App() {
  // --- Custom Hooks ---
  const appData = useAppData();
  const {
    links, categories, syncStatus, webDavConfig, passwordExpiryConfig, siteConfig, aiSortConfig,
    setLinks, setCategories, setAppDataVersion, setPasswordExpiryConfig, setSiteConfig, setAiSortConfig,
    loadFromLocal, syncToCloud, loadLinkIcons,
    handleSaveWebDavConfig, handleSaveAiSortConfig,
  } = appData;

  const search = useSearch();
  const {
    searchQuery, setSearchQuery, debouncedSearchQuery,
    searchMode, externalSearchSources, selectedSearchSource, setSelectedSearchSource,
    showSearchSourcePopup, setShowSearchSourcePopup,
    hoveredSearchSource, setHoveredSearchSource,
    isIconHovered, setIsIconHovered,
    isPopupHovered, setIsPopupHovered,
    handleSaveSearchConfig, handleSearchSourceSelect,
    setSearchMode, setExternalSearchSources,
  } = search;

  const ctxMenu = useContextMenu();
  const { contextMenu, qrCodeModal, closeQrCodeModal } = ctxMenu;

  // --- Local State ---
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  // Auth State
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const isAuthenticated = !!authToken;

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Batch Edit State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());

  // AI Sort State
  const [isAiSorting, setIsAiSorting] = useState(false);

  // --- Wrapper: updateData with current authToken ---
  const updateData = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    appData.updateData(newLinks, newCategories, authToken);
  }, [appData.updateData, authToken]);

  // --- Context Menu action wrappers ---
  const handleContextMenu = useCallback((event: React.MouseEvent, link: LinkItem) => {
    ctxMenu.handleContextMenu(event, link, isBatchEditMode);
  }, [ctxMenu.handleContextMenu, isBatchEditMode]);

  const editLinkFromContextMenu = useCallback(() => {
    ctxMenu.editLinkFromContextMenu((link) => {
      setEditingLink(link);
      setIsModalOpen(true);
    });
  }, [ctxMenu.editLinkFromContextMenu]);

  const deleteLinkFromContextMenu = useCallback(() => {
    ctxMenu.deleteLinkFromContextMenu((link) => {
      const newLinks = links.filter(l => l.id !== link.id);
      updateData(newLinks, categories);
    });
  }, [ctxMenu.deleteLinkFromContextMenu, links, categories, updateData]);

  const togglePinFromContextMenu = useCallback(() => {
    ctxMenu.togglePinFromContextMenu(links, (updated) => {
      updateData(updated, categories);
    });
  }, [ctxMenu.togglePinFromContextMenu, links, categories, updateData]);

  // --- Effects ---

  useEffect(() => {
    // Theme init
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }

    // Load Token
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      window.history.replaceState({}, '', window.location.pathname);
      setPrefillLink({ title: addTitle, url: addUrl, categoryId: 'common' });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }

    // Initial Data Fetch
    const initData = async () => {
      // 首先检查是否需要认证
      try {
        const authHeaders: Record<string, string> = savedToken ? { 'x-auth-password': savedToken } : {};
        const authRes = await fetch('/api/storage?checkAuth=true', { headers: authHeaders });
        if (authRes.ok) {
          const authData = await authRes.json();
          setRequiresAuth(authData.requiresAuth);

          if (authData.requiresAuth && !savedToken) {
            setIsAuthOpen(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to check auth requirement.", e);
      }

      // 获取数据
      let hasCloudData = false;
      try {
        const res = await fetch('/api/storage', {
          headers: savedToken ? { 'x-auth-password': savedToken } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.links)) {
            setLinks(data.links);
            setCategories(data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify({
              links: data.links,
              categories: data.categories || DEFAULT_CATEGORIES
            }));
            if (typeof data.version === 'number') {
              setAppDataVersion(data.version);
            }
            // FIX: pass savedToken directly to avoid stale closure
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
      } catch (e) {
        console.warn("Failed to fetch from cloud, falling back to local.", e);
      }

      // 并行请求所有配置
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

        if (websiteConfigRes.ok) {
          const d = await websiteConfigRes.json();
          if (d?.passwordExpiry) setPasswordExpiryConfig(d.passwordExpiry);
        }

        if (siteConfigRes.ok) {
          const d = await siteConfigRes.json();
          if (d) { setSiteConfig(d); applySiteConfig(d); }
        }

        if (aiSortConfigRes.ok) {
          const d = await aiSortConfigRes.json();
          if (d && (d.apiUrl || d.apiKey || d.model)) {
            setAiSortConfig(d);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch configs from KV.", e);
      }

      if (hasCloudData) return;

      loadFromLocal();
      setSearchMode('internal');
      setExternalSearchSources(createSearchSources());
    };

    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Batch Edit Functions ---
  const toggleBatchEditMode = useCallback(() => {
    setIsBatchEditMode(prev => !prev);
    setSelectedLinks(new Set());
  }, []);

  const toggleLinkSelection = useCallback((linkId: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) newSet.delete(linkId);
      else newSet.add(linkId);
      return newSet;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (selectedLinks.size === 0) { alert('请先选择要删除的链接'); return; }
    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      updateData(links.filter(link => !selectedLinks.has(link.id)), categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  }, [authToken, selectedLinks, links, categories, updateData]);

  const handleBatchMove = useCallback((targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (selectedLinks.size === 0) { alert('请先选择要移动的链接'); return; }
    updateData(
      links.map(link => selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link),
      categories,
    );
    setSelectedLinks(new Set());
    setIsBatchEditMode(false);
  }, [authToken, selectedLinks, links, categories, updateData]);

  // --- Auth Actions ---

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

      // 获取网站配置
      let passwordExpirySettings: PasswordExpiryConfig = { value: 1, unit: 'week' };
      try {
        const websiteConfigRes = await fetch('/api/storage?getConfig=website');
        if (websiteConfigRes.ok) {
          const d = await websiteConfigRes.json();
          if (d?.passwordExpiry) {
            passwordExpirySettings = d.passwordExpiry;
            setPasswordExpiryConfig(passwordExpirySettings);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch website config after login.", e);
      }

      // 更新最后登录时间
      localStorage.setItem('lastLoginTime', Date.now().toString());

      // 登录成功后获取数据
      try {
        const res = await fetch('/api/storage', { headers: { 'x-auth-password': password } });
        if (res.ok) {
          const data = await res.json();
          if (data.links?.length > 0) {
            setLinks(data.links);
            setCategories(data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify(data));
            loadLinkIcons(data.links, password);
          } else {
            localStorage.setItem(STORAGE_KEYS.LOCAL_DATA, JSON.stringify({ links, categories }));
            syncToCloud(links, categories, password);
            loadLinkIcons(links, password);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch data after login.", e);
        loadFromLocal();
        syncToCloud(links, categories, password);
      }

      return true;
    } catch {
      return false;
    }
  }, [links, categories, setLinks, setCategories, loadLinkIcons, syncToCloud, loadFromLocal, setPasswordExpiryConfig]);

  const handleLogout = useCallback(() => {
    setAuthToken('');
    localStorage.removeItem(AUTH_KEY);
    loadFromLocal();
  }, [loadFromLocal]);

  // 分类操作密码验证
  const handleCategoryActionAuth = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-password': password },
        body: JSON.stringify({ authOnly: true }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleImportConfirm = useCallback((newLinks: LinkItem[], newCategories: Category[]) => {
    const mergedCategories = [...categories];
    if (!mergedCategories.some(c => c.id === 'common')) {
      mergedCategories.push({ id: 'common', name: '常用推荐', icon: 'Star' });
    }
    newCategories.forEach(nc => {
      if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) {
        mergedCategories.push(nc);
      }
    });
    updateData([...links, ...newLinks], mergedCategories);
    setIsImportModalOpen(false);
    alert(`成功导入 ${newLinks.length} 个新书签!`);
  }, [links, categories, updateData]);

  const handleAddLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    const processedUrl = ensureProtocol(data.url);

    const newLink: LinkItem = {
      ...data,
      url: processedUrl,
      id: Date.now().toString(),
      createdAt: Date.now(),
      pinnedOrder: data.pinned ? links.filter(l => l.pinned).length : undefined,
    };

    if (newLink.pinned) {
      const firstNonPinnedIndex = links.findIndex(link => !link.pinned);
      if (firstNonPinnedIndex === -1) {
        updateData([...links, newLink], categories);
      } else {
        const updatedLinks = [...links];
        updatedLinks.splice(firstNonPinnedIndex, 0, newLink);
        updateData(updatedLinks, categories);
      }
    } else {
      const updatedLinks = [...links, newLink].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return compareByOrder(a, b);
      });
      updateData(updatedLinks, categories);
    }
    setPrefillLink(undefined);
  }, [authToken, links, categories, updateData]);

  const handleEditLink = useCallback((data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;

    const processedUrl = ensureProtocol(data.url);
    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  }, [authToken, editingLink, links, categories, updateData]);

  const handleDeleteLink = useCallback((id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  }, [authToken, links, categories, updateData]);

  const handleSavePasswordExpiryConfig = useCallback(async (config: PasswordExpiryConfig) => {
    await appData.handleSavePasswordExpiryConfig(config, authToken);
  }, [appData.handleSavePasswordExpiryConfig, authToken]);

  const handleSaveSiteConfig = useCallback(async (config: any) => {
    await appData.handleSaveSiteConfig(config, authToken);
  }, [appData.handleSaveSiteConfig, authToken]);

  const handleSaveAiSortConfigWrapper = useCallback(async (config: AiSortConfig) => {
    await handleSaveAiSortConfig(config, authToken);
  }, [handleSaveAiSortConfig, authToken]);

  const handleAiSort = useCallback(async () => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!aiSortConfig.apiUrl || !aiSortConfig.apiKey || !aiSortConfig.model) {
      alert('请先在设置 → AI 排序中配置 API 地址、Key 和模型');
      return;
    }
    if (links.length === 0) { alert('没有书签可以整理'); return; }
    if (!confirm(`将使用 AI 对 ${links.length} 个书签进行智能分类和排序，常用推荐分类的书签不会被移动。是否继续？`)) return;

    setIsAiSorting(true);
    try {
      const result = await aiSortLinks(links, categories, aiSortConfig, authToken);
      updateData(result.links, result.categories);
      const msg = result.newCategoriesCreated.length > 0
        ? `AI 整理完成！新建了 ${result.newCategoriesCreated.length} 个分类：${result.newCategoriesCreated.join('、')}`
        : 'AI 整理完成！书签已重新分类和排序。';
      alert(msg);
    } catch (error: any) {
      alert(`AI 整理失败：${error.message || '未知错误'}`);
      console.error('AI sort error:', error);
    } finally {
      setIsAiSorting(false);
    }
  }, [authToken, aiSortConfig, links, categories, updateData]);

  // --- Category Management ---

  const handleUnlockCategory = useCallback((catId: string) => {
    setUnlockedCategoryIds(prev => new Set(prev).add(catId));
    setSelectedCategory(catId);
  }, []);

  const handleUpdateCategories = useCallback((newCats: Category[]) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    updateData(links, newCats);
  }, [authToken, links, updateData]);

  const handleDeleteCategory = useCallback((catId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (catId === 'common') { alert('"常用推荐"分类不能被删除'); return; }

    let newCats = categories.filter(c => c.id !== catId);
    if (!newCats.some(c => c.id === 'common')) {
      newCats = [{ id: 'common', name: '常用推荐', icon: 'Star' }, ...newCats];
    }
    const newLinks = links.map(l => l.categoryId === catId ? { ...l, categoryId: 'common' } : l);
    updateData(newLinks, newCats);
  }, [authToken, categories, links, updateData]);

  const handleSearchSourceSelectWrapper = useCallback(
    (source: any) => handleSearchSourceSelect(source, authToken),
    [handleSearchSourceSelect, authToken],
  );

  const handleRestoreBackup = useCallback((restoredLinks: LinkItem[], restoredCategories: Category[]) => {
    updateData(restoredLinks, restoredCategories);
    setIsBackupModalOpen(false);
  }, [updateData]);

  const handleRestoreSearchConfig = useCallback((restoredSearchConfig: SearchConfig) => {
    handleSaveSearchConfig(restoredSearchConfig.externalSources, restoredSearchConfig.mode, authToken);
  }, [handleSaveSearchConfig, authToken]);

  // --- Filtering & Memo ---

  const isCategoryLocked = useCallback((catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !cat.password) return false;
    return !unlockedCategoryIds.has(catId);
  }, [categories, unlockedCategoryIds]);

  const displayedLinks = useMemo(() => {
    let result = links.filter(l => !isCategoryLocked(l.categoryId));

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // FIX: use slice() to avoid mutating the filtered array (which references state)
    return result.slice().sort(compareByOrder);
  }, [links, debouncedSearchQuery, categories, unlockedCategoryIds, isCategoryLocked]);

  const linksByCategory = useMemo(() => {
    const map = new Map<string, LinkItem[]>();
    for (const cat of categories) {
      // filter() already returns a new array, safe to sort
      map.set(cat.id, links.filter(l => l.categoryId === cat.id).sort(compareByOrder));
    }
    return map;
  }, [links, categories]);

  const handleSelectAll = useCallback(() => {
    const currentLinkIds = displayedLinks.map(link => link.id);
    if (selectedLinks.size === currentLinkIds.length && currentLinkIds.every(id => selectedLinks.has(id))) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(currentLinkIds));
    }
  }, [displayedLinks, selectedLinks]);

  // Memoize greeting to avoid recalc on every render
  const greeting = useMemo(() => getStatusGreeting(), []);

  // FIX: safe hostname extraction for search source icons (prevents crash from invalid URLs with {query})
  const activeSearchSource = hoveredSearchSource || selectedSearchSource;
  const activeSearchHostname = activeSearchSource ? safeHostname(activeSearchSource.url) : '';

  // --- Render ---

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {/* 樱花飘落背景 */}
      <SakuraBackground />
      {/* 认证遮罩层 */}
      {requiresAuth && !authToken && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                需要身份验证
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                此导航页面设置了访问密码，请输入密码以继续访问
              </p>
            </div>
            <AuthModal isOpen={true} onLogin={handleLogin} />
          </div>
        </div>
      )}

      {/* 主要内容 */}
      {(!requiresAuth || authToken) && (
        <>
          <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />

          <Suspense fallback={<ModalFallback />}>
            {!!catAuthModalData && (
              <CategoryAuthModal
                isOpen={!!catAuthModalData}
                category={catAuthModalData}
                onClose={() => setCatAuthModalData(null)}
                onUnlock={handleUnlockCategory}
              />
            )}

            {isCatManagerOpen && (
              <CategoryManagerModal
                isOpen={isCatManagerOpen}
                onClose={() => setIsCatManagerOpen(false)}
                categories={categories}
                onUpdateCategories={handleUpdateCategories}
                onDeleteCategory={handleDeleteCategory}
                onVerifyPassword={handleCategoryActionAuth}
              />
            )}

            {isBackupModalOpen && (
              <BackupModal
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                links={links}
                categories={categories}
                onRestore={handleRestoreBackup}
                webDavConfig={webDavConfig}
                onSaveWebDavConfig={handleSaveWebDavConfig}
                searchConfig={{ mode: searchMode, externalSources: externalSearchSources }}
                onRestoreSearchConfig={handleRestoreSearchConfig}
              />
            )}

            {isImportModalOpen && (
              <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                existingLinks={links}
                categories={categories}
                onImport={handleImportConfirm}
                onImportSearchConfig={handleRestoreSearchConfig}
              />
            )}

            {isSettingsModalOpen && (
              <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                passwordExpiryConfig={passwordExpiryConfig}
                onSavePasswordExpiry={handleSavePasswordExpiryConfig}
                siteConfig={siteConfig}
                onSaveSiteConfig={handleSaveSiteConfig}
                aiSortConfig={aiSortConfig}
                onSaveAiSortConfig={handleSaveAiSortConfigWrapper}
              />
            )}
          </Suspense>

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto relative w-full">

            {/* Header */}
            <header className="h-14 sm:h-16 px-3 sm:px-4 lg:px-6 flex items-center justify-between bg-white/95 dark:bg-slate-800/95 sm:bg-white/80 sm:dark:bg-slate-800/80 backdrop-blur-sm sm:backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shrink-0 safe-area-top safe-area-x">
              <div className="flex items-center gap-4 sm:gap-6">
                <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {siteConfig.navigationName || 'Zmin Nav'}
                </span>
              </div>

              {/* Desktop Actions */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                  title="设置"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); } }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-full transition-all"
                >
                  <Plus size={14} /> 添加
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 transition-all"
                >
                  <Upload size={14} /> 导入
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 transition-all"
                >
                  <Settings size={14} /> 分类
                </button>
                <button
                  onClick={handleAiSort}
                  disabled={isAiSorting}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full transition-all disabled:opacity-60"
                  title="AI 智能整理书签"
                >
                  {isAiSorting ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} AI 整理
                </button>
              </div>

              {/* Mobile Menu Toggle */}
              <div className="flex sm:hidden items-center gap-1">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </header>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
              <div className="sm:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex flex-wrap gap-2 safe-area-x slide-down">
                <button
                  onClick={() => { setIsSettingsModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-600 transition-colors"
                >
                  <Settings size={16} /> 设置
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-600 transition-colors"
                >
                  <Upload size={16} /> 导入
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-600 transition-colors"
                >
                  <FolderInput size={16} /> 分类
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsBackupModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-600 transition-colors"
                >
                  <Upload size={16} /> 备份
                </button>
                <button
                  onClick={() => { toggleBatchEditMode(); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isBatchEditMode
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600'
                  }`}
                >
                  <CheckSquare size={16} /> 批量编辑
                </button>
                <button
                  onClick={() => { handleAiSort(); setIsMobileMenuOpen(false); }}
                  disabled={isAiSorting}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg active:from-purple-600 active:to-pink-600 transition-colors disabled:opacity-60"
                >
                  {isAiSorting ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} AI 整理
                </button>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-8 space-y-6 sm:space-y-8 scroll-smooth">

              {/* Hero Search Section */}
              <section className="flex flex-col items-center justify-center pt-[15vh] pb-4 sm:py-12 md:py-20 fade-up">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-4 sm:mb-8 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 bg-clip-text text-transparent gradient-shimmer">
                  {greeting}
                </h1>

                {/* 搜索框 */}
                <div className="relative w-full max-w-2xl mx-auto shadow-xl shadow-blue-500/10 rounded-full group search-glow transition-all duration-300">
                  {/* 搜索源选择弹出窗口 */}
                  {showSearchSourcePopup && (
                    <div
                      className="absolute left-0 top-full mt-4 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-4 z-50 scale-in"
                      onMouseEnter={() => setIsPopupHovered(true)}
                      onMouseLeave={() => setIsPopupHovered(false)}
                    >
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3">
                        {externalSearchSources
                          .filter(source => source.enabled)
                          .map((source, index) => {
                            // FIX: extract hostname safely to prevent crash
                            const hostname = safeHostname(source.url);
                            return (
                              <button
                                key={source.id || index}
                                onClick={() => handleSearchSourceSelectWrapper(source)}
                                onMouseEnter={() => setHoveredSearchSource(source)}
                                onMouseLeave={() => setHoveredSearchSource(null)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors group/item"
                              >
                                <div className="p-2 bg-white dark:bg-slate-600 rounded-lg shadow-sm border border-slate-100 dark:border-slate-500 group-hover/item:scale-110 transition-transform">
                                  {hostname ? (
                                    <img
                                      src={`https://www.faviconextractor.com/favicon/${hostname}?larger=true`}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
                                      }}
                                      alt={source.name}
                                      className="w-5 h-5"
                                    />
                                  ) : (
                                    <Search size={20} className="text-slate-400" />
                                  )}
                                </div>
                                <span className="text-xs font-medium truncate w-full text-center">{source.name}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* 搜索图标/引擎图标 */}
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setShowSearchSourcePopup(!showSearchSourcePopup)}
                    onMouseEnter={() => setIsIconHovered(true)}
                    onMouseLeave={() => setIsIconHovered(false)}
                    title="切换搜索引擎"
                  >
                    {activeSearchSource && activeSearchHostname ? (
                      <img
                        src={`https://www.faviconextractor.com/favicon/${activeSearchHostname}?larger=true`}
                        alt={activeSearchSource.name}
                        className="w-6 h-6"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${activeSearchHostname}&sz=32`;
                        }}
                      />
                    ) : (
                      <Search size={22} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder={selectedSearchSource ? `在 ${selectedSearchSource.name} 搜索...` : "输入搜索内容..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && selectedSearchSource) {
                        const searchUrl = selectedSearchSource.url.replace('{query}', encodeURIComponent(searchQuery));
                        window.open(searchUrl, '_blank');
                      }
                    }}
                    className="w-full pl-14 pr-14 py-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-base focus:border-blue-500 focus:ring-0 dark:focus:border-blue-500 dark:text-white placeholder-slate-400 outline-none transition-all"
                  />

                  {searchQuery.trim() && (
                    <button
                      onClick={() => {
                        if (selectedSearchSource) {
                          const searchUrl = selectedSearchSource.url.replace('{query}', encodeURIComponent(searchQuery));
                          window.open(searchUrl, '_blank');
                        }
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </section>

              {/* 搜索结果 */}
              {debouncedSearchQuery.trim() && displayedLinks.length > 0 ? (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="text-blue-500" size={24} />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">搜索结果</h2>
                    <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{displayedLinks.length}</span>
                  </div>
                  <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                    {displayedLinks.map(link => (
                      <LinkCard
                        key={link.id}
                        link={link}
                        isBatchEditMode={isBatchEditMode}
                        isSelected={selectedLinks.has(link.id)}
                        onToggleSelection={toggleLinkSelection}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </div>
                </section>
              ) : debouncedSearchQuery.trim() && displayedLinks.length === 0 ? (
                <section className="py-12 text-center">
                  <Search className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                  <p className="text-slate-500 dark:text-slate-400">没有找到匹配的链接</p>
                </section>
              ) : (
                <>
                  {/* 分类循环 */}
                  {categories.map((cat, index) => {
                    const catLinks = linksByCategory.get(cat.id) || [];
                    const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);

                    if (catLinks.length === 0 && !isAuthenticated) return null;

                    return (
                      <section key={cat.id} id={`cat-${cat.id}`} className="fade-up" style={{ animationDelay: `${index * 60}ms` }}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <Icon name={cat.icon} size={18} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{cat.name}</h2>
                          {isLocked && <Lock size={14} className="text-amber-500" />}
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{catLinks.length}</span>
                        </div>

                        {isLocked ? (
                          <div className="flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Lock size={24} className="text-amber-500 mb-2" />
                            <p className="text-slate-500 text-sm mb-3">此分类已锁定</p>
                            <button
                              onClick={() => setCatAuthModalData(cat)}
                              className="px-4 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-full hover:bg-amber-600 transition-colors"
                            >
                              输入密码解锁
                            </button>
                          </div>
                        ) : (
                          <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                            {catLinks.map(link => (
                              <LinkCard
                                key={link.id}
                                link={link}
                                isBatchEditMode={isBatchEditMode}
                                isSelected={selectedLinks.has(link.id)}
                                onToggleSelection={toggleLinkSelection}
                                onContextMenu={handleContextMenu}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </main>

          <Suspense fallback={<ModalFallback />}>
            {isModalOpen && (
              <LinkModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
                onSave={editingLink ? handleEditLink : handleAddLink}
                onDelete={editingLink ? handleDeleteLink : undefined}
                categories={categories}
                initialData={editingLink || (prefillLink as LinkItem)}
                defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
              />
            )}
          </Suspense>

          {/* Mobile FAB: Add Link */}
          <button
            onClick={() => { if (!authToken) setIsAuthOpen(true); else { setEditingLink(undefined); setPrefillLink(undefined); setIsModalOpen(true); } }}
            className="sm:hidden fixed right-4 bottom-4 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-90 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-200 safe-area-bottom fab-pulse"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <Plus size={24} />
          </button>

          {/* Mobile Batch Edit Toolbar */}
          {isBatchEditMode && (
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3 safe-area-bottom safe-area-x slide-up-sheet">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  已选 <b className="text-blue-600 dark:text-blue-400">{selectedLinks.size}</b> 项
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                    {selectedLinks.size === displayedLinks.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedLinks.size === 0}
                    className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg disabled:opacity-40"
                  >
                    <Trash2 size={14} className="inline mr-1" />删除
                  </button>
                  <button onClick={toggleBatchEditMode} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
                    完成
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 右键菜单 */}
          <ContextMenu
            isOpen={contextMenu.isOpen}
            position={contextMenu.position}
            onClose={ctxMenu.closeContextMenu}
            onCopyLink={ctxMenu.copyLinkToClipboard}
            onShowQRCode={ctxMenu.showQRCode}
            onEditLink={editLinkFromContextMenu}
            onDeleteLink={deleteLinkFromContextMenu}
            onTogglePin={togglePinFromContextMenu}
          />

          {/* 二维码模态框 */}
          <Suspense fallback={<ModalFallback />}>
            {qrCodeModal.isOpen && (
              <QRCodeModal
                isOpen={qrCodeModal.isOpen}
                url={qrCodeModal.url || ''}
                title={qrCodeModal.title || ''}
                onClose={closeQrCodeModal}
              />
            )}
          </Suspense>
        </>
      )}
    </div>
  );
}

export default App;

