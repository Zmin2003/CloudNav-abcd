
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, X, ChevronRight, ChevronDown, Check, GripVertical, Moon, Sun, Monitor, Menu, MoreVertical, LogOut, Settings, Upload, Download, RefreshCw, AlertCircle, ExternalLink, Shield, Key, Pin, LayoutGrid, ArrowRight, Lock, Icon as LucideIcon } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, WebDavConfig, SearchMode, ExternalSearchSource, SearchConfig, PasswordExpiryConfig, SiteConfig } from './types';
import { parseBookmarks } from './services/bookmarkParser';
import { createSearchSources, STORAGE_KEYS, GITHUB_REPO_URL } from './constants';
import Icon from './components/Icon';
import LinkModal from './components/LinkModal';
import AuthModal from './components/AuthModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import BackupModal from './components/BackupModal';
import CategoryAuthModal from './components/CategoryAuthModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import SearchConfigModal from './components/SearchConfigModal';
import ContextMenu from './components/ContextMenu';
import QRCodeModal from './components/QRCodeModal';
import SortableLinkCard from './components/SortableLinkCard';
import ErrorBoundary from './components/ErrorBoundary';

// --- 配置项 ---
// 使用常量模块中的配置

const LOCAL_STORAGE_KEY = STORAGE_KEYS.LOCAL_DATA;
const AUTH_KEY = STORAGE_KEYS.AUTH_TOKEN;
const WEBDAV_CONFIG_KEY = STORAGE_KEYS.WEBDAV_CONFIG;

const SEARCH_CONFIG_KEY = STORAGE_KEYS.SEARCH_CONFIG;

function App() {
  // --- State ---
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // Search Mode State
  const [searchMode, setSearchMode] = useState<SearchMode>('internal');
  const [externalSearchSources, setExternalSearchSources] = useState<ExternalSearchSource[]>([]);
  const [isLoadingSearchConfig, setIsLoadingSearchConfig] = useState(true);

  // Category Security State
  const [unlockedCategoryIds, setUnlockedCategoryIds] = useState<Set<string>>(new Set());

  // WebDAV Config State
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
    url: '',
    username: '',
    password: '',
    enabled: false
  });



  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSearchConfigModalOpen, setIsSearchConfigModalOpen] = useState(false);
  const [catAuthModalData, setCatAuthModalData] = useState<Category | null>(null);

  const [editingLink, setEditingLink] = useState<LinkItem | undefined>(undefined);
  // State for data pre-filled from Bookmarklet
  const [prefillLink, setPrefillLink] = useState<Partial<LinkItem> | undefined>(undefined);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authToken, setAuthToken] = useState<string>('');
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null); // null表示未检查，true表示需要认证，false表示不需要
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isAuthenticated = !!authToken;

  // Sort State
  const [isSortingMode, setIsSortingMode] = useState<string | null>(null); // 存储正在排序的分类ID，null表示不在排序模式
  const [isSortingPinned, setIsSortingPinned] = useState(false); // 是否正在排序置顶链接

  // Batch Edit State
  const [isBatchEditMode, setIsBatchEditMode] = useState(false); // 是否处于批量编辑模式
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set()); // 选中的链接ID集合



  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    link: LinkItem | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    link: null
  });

  // QR Code Modal State
  const [qrCodeModal, setQrCodeModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
  }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Mobile Search State
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Category Action Auth State
  const [categoryActionAuth, setCategoryActionAuth] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
    categoryId: string;
    categoryName: string;
  }>({
    isOpen: false,
    action: 'edit',
    categoryId: '',
    categoryName: ''
  });

  // Password Expiry Config State
  const [passwordExpiryConfig, setPasswordExpiryConfig] = useState<PasswordExpiryConfig>({
    value: 1,
    unit: 'week'
  });

  // Site Config State (网站自定义配置)
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({});

  // --- Helpers & Sync Logic ---

  const loadFromLocal = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;

        // 确保"常用推荐"分类始终存在，并确保它是第一个分类
        if (!loadedCategories.some(c => c.id === 'common')) {
          loadedCategories = [
            { id: 'common', name: '常用推荐', icon: 'Star' },
            ...loadedCategories
          ];
        } else {
          // 如果"常用推荐"分类已存在，确保它是第一个分类
          const commonIndex = loadedCategories.findIndex(c => c.id === 'common');
          if (commonIndex > 0) {
            const commonCategory = loadedCategories[commonIndex];
            loadedCategories = [
              commonCategory,
              ...loadedCategories.slice(0, commonIndex),
              ...loadedCategories.slice(commonIndex + 1)
            ];
          }
        }

        // 检查是否有链接的categoryId不存在于当前分类中，将这些链接移动到"常用推荐"
        const validCategoryIds = new Set(loadedCategories.map(c => c.id));
        let loadedLinks = parsed.links || INITIAL_LINKS;
        loadedLinks = loadedLinks.map(link => {
          if (!validCategoryIds.has(link.categoryId)) {
            return { ...link, categoryId: 'common' };
          }
          return link;
        });

        setLinks(loadedLinks);
        setCategories(loadedCategories);
      } catch (e) {
        setLinks(INITIAL_LINKS);
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const syncToCloud = async (newLinks: LinkItem[], newCategories: Category[], token: string) => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': token
        },
        body: JSON.stringify({ links: newLinks, categories: newCategories })
      });

      if (response.status === 401) {
        // 检查是否是密码过期
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.includes('过期')) {
            alert('您的密码已过期，请重新登录');
          }
        } catch (e) {
          // 如果无法解析错误信息，使用默认提示
          console.error('Failed to parse error response', e);
        }

        setAuthToken('');
        localStorage.removeItem(AUTH_KEY);
        setIsAuthOpen(true);
        setSyncStatus('error');
        return false;
      }

      if (!response.ok) throw new Error('Network response was not ok');

      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } catch (error) {
      console.error("Sync failed", error);
      setSyncStatus('error');
      return false;
    }
  };

  const updateData = (newLinks: LinkItem[], newCategories: Category[]) => {
    // 1. Optimistic UI Update
    setLinks(newLinks);
    setCategories(newCategories);

    // 2. Save to Local Cache
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: newLinks, categories: newCategories }));

    // 3. Sync to Cloud (if authenticated)
    if (authToken) {
      syncToCloud(newLinks, newCategories, authToken);
    }
  };

  // --- Context Menu Functions ---
  const handleContextMenu = (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();

    // 在批量编辑模式下禁用右键菜单
    if (isBatchEditMode) return;

    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link: link
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      link: null
    });
  };

  const copyLinkToClipboard = () => {
    if (!contextMenu.link) return;

    navigator.clipboard.writeText(contextMenu.link.url)
      .then(() => {
        // 可以添加一个短暂的提示
        console.log('链接已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制链接失败:', err);
      });

    closeContextMenu();
  };

  const showQRCode = () => {
    if (!contextMenu.link) return;

    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title
    });

    closeContextMenu();
  };

  const editLinkFromContextMenu = () => {
    if (!contextMenu.link) return;

    setEditingLink(contextMenu.link);
    setIsModalOpen(true);
    closeContextMenu();
  };

  const deleteLinkFromContextMenu = () => {
    if (!contextMenu.link) return;

    if (window.confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      const newLinks = links.filter(link => link.id !== contextMenu.link!.id);
      updateData(newLinks, categories);
    }

    closeContextMenu();
  };

  const togglePinFromContextMenu = () => {
    if (!contextMenu.link) return;

    const linkToToggle = links.find(l => l.id === contextMenu.link!.id);
    if (!linkToToggle) return;

    // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
    // 如果是取消置顶，则清除pinnedOrder
    const updated = links.map(l => {
      if (l.id === contextMenu.link!.id) {
        const isPinned = !l.pinned;
        return {
          ...l,
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
        };
      }
      return l;
    });

    updateData(updated, categories);
    closeContextMenu();
  };

  // 加载链接图标缓存
  const loadLinkIcons = async (linksToLoad: LinkItem[]) => {
    if (!authToken) return; // 只有在已登录状态下才加载图标缓存

    const updatedLinks = [...linksToLoad];
    const domainsToFetch: string[] = [];

    // 收集所有链接的域名（包括已有图标的链接）
    for (const link of updatedLinks) {
      if (link.url) {
        try {
          let domain = link.url;
          if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
            domain = 'https://' + link.url;
          }

          if (domain.startsWith('http://') || domain.startsWith('https://')) {
            const urlObj = new URL(domain);
            domain = urlObj.hostname;
            domainsToFetch.push(domain);
          }
        } catch (e) {
          console.error("Failed to parse URL for icon loading", e);
        }
      }
    }

    // 批量获取图标
    if (domainsToFetch.length > 0) {
      const iconPromises = domainsToFetch.map(async (domain) => {
        try {
          const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.cached && data.icon) {
              return { domain, icon: data.icon };
            }
          }
        } catch (error) {
          console.log(`Failed to fetch cached icon for ${domain}`, error);
        }
        return null;
      });

      const iconResults = await Promise.all(iconPromises);

      // 更新链接的图标
      iconResults.forEach(result => {
        if (result) {
          const linkToUpdate = updatedLinks.find(link => {
            if (!link.url) return false;
            try {
              let domain = link.url;
              if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                domain = 'https://' + link.url;
              }

              if (domain.startsWith('http://') || domain.startsWith('https://')) {
                const urlObj = new URL(domain);
                return urlObj.hostname === result.domain;
              }
            } catch (e) {
              return false;
            }
            return false;
          });

          if (linkToUpdate) {
            // 只有当链接没有图标，或者当前图标是faviconextractor.com生成的，或者缓存中的图标是自定义图标时才更新
            if (!linkToUpdate.icon ||
              linkToUpdate.icon.includes('faviconextractor.com') ||
              !result.icon.includes('faviconextractor.com')) {
              linkToUpdate.icon = result.icon;
            }
          }
        }
      });

      // 更新状态
      setLinks(updatedLinks);
    }
  };

  // --- Effects ---

  useEffect(() => {
    // Theme init
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load Token
    const savedToken = localStorage.getItem(AUTH_KEY);
    if (savedToken) setAuthToken(savedToken);

    // Load WebDAV Config
    const savedWebDav = localStorage.getItem(WEBDAV_CONFIG_KEY);
    if (savedWebDav) {
      try {
        setWebDavConfig(JSON.parse(savedWebDav));
      } catch (e) { }
    }

    // Handle URL Params for Bookmarklet (Add Link)
    const urlParams = new URLSearchParams(window.location.search);
    const addUrl = urlParams.get('add_url');
    if (addUrl) {
      const addTitle = urlParams.get('add_title') || '';
      // Clean URL params to avoid re-triggering on refresh
      window.history.replaceState({}, '', window.location.pathname);

      setPrefillLink({
        title: addTitle,
        url: addUrl,
        categoryId: 'common' // Default, Modal will handle selection
      });
      setEditingLink(undefined);
      setIsModalOpen(true);
    }

    // Initial Data Fetch
    const initData = async () => {
      // 首先检查是否需要认证
      try {
        const authRes = await fetch('/api/storage?checkAuth=true');
        if (authRes.ok) {
          const authData = await authRes.json();
          setRequiresAuth(authData.requiresAuth);

          // 如果需要认证但用户未登录，则不获取数据
          if (authData.requiresAuth && !savedToken) {
            setIsCheckingAuth(false);
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
          headers: authToken ? { 'x-auth-password': authToken } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data.links && data.links.length > 0) {
            setLinks(data.links);
            setCategories(data.categories || DEFAULT_CATEGORIES);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

            // 加载链接图标缓存
            loadLinkIcons(data.links);
            hasCloudData = true;
          }
        } else if (res.status === 401) {
          // 如果返回401，可能是密码过期，清除本地token并要求重新登录
          const errorData = await res.json();
          if (errorData.error && errorData.error.includes('过期')) {
            setAuthToken(null);
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            setIsCheckingAuth(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch from cloud, falling back to local.", e);
      }

      // 无论是否有云端数据，都尝试从KV空间加载搜索配置和网站配置
      try {
        const searchConfigRes = await fetch('/api/storage?getConfig=search');
        if (searchConfigRes.ok) {
          const searchConfigData = await searchConfigRes.json();
          // 检查搜索配置是否有效（包含必要的字段）
          if (searchConfigData && (searchConfigData.mode || searchConfigData.externalSources || searchConfigData.selectedSource)) {
            setSearchMode(searchConfigData.mode || 'internal');
            setExternalSearchSources(searchConfigData.externalSources || []);
            // 加载已保存的选中搜索源
            if (searchConfigData.selectedSource) {
              setSelectedSearchSource(searchConfigData.selectedSource);
            }
          }
        }

        // 获取网站配置（包括密码过期时间设置）
        const websiteConfigRes = await fetch('/api/storage?getConfig=website');
        if (websiteConfigRes.ok) {
          const websiteConfigData = await websiteConfigRes.json();
          if (websiteConfigData && websiteConfigData.passwordExpiry) {
            setPasswordExpiryConfig(websiteConfigData.passwordExpiry);
          }
        }

        // 获取站点自定义配置
        const siteConfigRes = await fetch('/api/storage?getConfig=site');
        if (siteConfigRes.ok) {
          const siteConfigData = await siteConfigRes.json();
          if (siteConfigData) {
            setSiteConfig(siteConfigData);
            // 应用网站标题
            if (siteConfigData.websiteTitle) {
              document.title = siteConfigData.websiteTitle;
            }
            // 应用网站图标
            if (siteConfigData.faviconUrl) {
              const existingFavicons = document.querySelectorAll('link[rel="icon"]');
              existingFavicons.forEach(favicon => favicon.remove());
              const favicon = document.createElement('link');
              favicon.rel = 'icon';
              favicon.href = siteConfigData.faviconUrl;
              document.head.appendChild(favicon);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch configs from KV.", e);
      }

      // 如果有云端数据，则不需要加载本地数据
      if (hasCloudData) {
        setIsCheckingAuth(false);
        return;
      }

      // 如果没有云端数据，则加载本地数据
      loadFromLocal();

      // 如果从KV空间加载搜索配置失败，直接使用默认配置（不使用localStorage回退）
      setSearchMode('internal');
      setExternalSearchSources(createSearchSources());

      setIsLoadingSearchConfig(false);
      setIsCheckingAuth(false);
    };

    initData();
  }, []);



  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };



  // --- Batch Edit Functions ---
  const toggleBatchEditMode = () => {
    setIsBatchEditMode(!isBatchEditMode);
    setSelectedLinks(new Set()); // 退出批量编辑模式时清空选中项
  };

  const toggleLinkSelection = (linkId: string) => {
    setSelectedLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(linkId)) {
        newSet.delete(linkId);
      } else {
        newSet.add(linkId);
      }
      return newSet;
    });
  };

  const handleBatchDelete = () => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedLinks.size === 0) {
      alert('请先选择要删除的链接');
      return;
    }

    if (confirm(`确定要删除选中的 ${selectedLinks.size} 个链接吗？`)) {
      const newLinks = links.filter(link => !selectedLinks.has(link.id));
      updateData(newLinks, categories);
      setSelectedLinks(new Set());
      setIsBatchEditMode(false);
    }
  };

  const handleBatchMove = (targetCategoryId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    if (selectedLinks.size === 0) {
      alert('请先选择要移动的链接');
      return;
    }

    const newLinks = links.map(link =>
      selectedLinks.has(link.id) ? { ...link, categoryId: targetCategoryId } : link
    );
    updateData(newLinks, categories);
    setSelectedLinks(new Set());
    setIsBatchEditMode(false);
  };

  const handleSelectAll = () => {
    // 获取当前显示的所有链接ID
    const currentLinkIds = displayedLinks.map(link => link.id);

    // 如果已选中的链接数量等于当前显示的链接数量，则取消全选
    if (selectedLinks.size === currentLinkIds.length && currentLinkIds.every(id => selectedLinks.has(id))) {
      setSelectedLinks(new Set());
    } else {
      // 否则全选当前显示的所有链接
      setSelectedLinks(new Set(currentLinkIds));
    }
  };

  // --- Actions ---

  const handleLogin = async (password: string): Promise<boolean> => {
    try {
      // 首先验证密码
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true }) // 只用于验证密码，不更新数据
      });

      if (authResponse.ok) {
        setAuthToken(password);
        localStorage.setItem(AUTH_KEY, password);
        setIsAuthOpen(false);
        setSyncStatus('saved');

        // 登录成功后，获取网站配置（包括密码过期时间设置）
        let passwordExpirySettings: PasswordExpiryConfig = { value: 1, unit: 'week' }; // 默认值
        try {
          const websiteConfigRes = await fetch('/api/storage?getConfig=website');
          if (websiteConfigRes.ok) {
            const websiteConfigData = await websiteConfigRes.json();
            if (websiteConfigData && websiteConfigData.passwordExpiry) {
              passwordExpirySettings = websiteConfigData.passwordExpiry;
              setPasswordExpiryConfig(passwordExpirySettings);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch website config after login.", e);
        }

        // 检查密码是否过期
        const lastLoginTime = localStorage.getItem('lastLoginTime');
        const currentTime = Date.now();

        if (lastLoginTime) {
          const lastLogin = parseInt(lastLoginTime);
          const timeDiff = currentTime - lastLogin;

          // 计算过期时间（毫秒）
          let expiryTimeMs = 0;
          if (passwordExpirySettings.unit === 'day') {
            expiryTimeMs = passwordExpirySettings.value * 24 * 60 * 60 * 1000;
          } else if (passwordExpirySettings.unit === 'week') {
            expiryTimeMs = passwordExpirySettings.value * 7 * 24 * 60 * 60 * 1000;
          } else if (passwordExpirySettings.unit === 'month') {
            expiryTimeMs = passwordExpirySettings.value * 30 * 24 * 60 * 60 * 1000;
          } else if (passwordExpirySettings.unit === 'year') {
            expiryTimeMs = passwordExpirySettings.value * 365 * 24 * 60 * 60 * 1000;
          }

          // 如果设置了过期时间且已过期
          if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
            // 密码已过期，清除认证信息并提示用户
            setAuthToken(null);
            localStorage.removeItem(AUTH_KEY);
            setIsAuthOpen(true);
            alert('您的密码已过期，请重新登录');
            return false;
          }
        }

        // 更新最后登录时间
        localStorage.setItem('lastLoginTime', currentTime.toString());

        // 登录成功后，从服务器获取数据
        try {
          const res = await fetch('/api/storage', {
            headers: { 'x-auth-password': password }
          });
          if (res.ok) {
            const data = await res.json();
            // 如果服务器有数据，使用服务器数据
            if (data.links && data.links.length > 0) {
              setLinks(data.links);
              setCategories(data.categories || DEFAULT_CATEGORIES);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));

              // 加载链接图标缓存
              loadLinkIcons(data.links);
            } else {
              // 如果服务器没有数据，使用本地数据
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links, categories }));
              // 并将本地数据同步到服务器
              syncToCloud(links, categories, password);

              // 加载链接图标缓存
              loadLinkIcons(links);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch data after login.", e);
          loadFromLocal();
          // 尝试将本地数据同步到服务器
          syncToCloud(links, categories, password);
        }



        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem(AUTH_KEY);
    setSyncStatus('offline');
    // 退出后重新加载本地数据
    loadFromLocal();
  };

  // 分类操作密码验证处理函数
  const handleCategoryActionAuth = async (password: string): Promise<boolean> => {
    try {
      // 验证密码
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true })
      });

      return authResponse.ok;
    } catch (error) {
      console.error('Category action auth error:', error);
      return false;
    }
  };

  // 打开分类操作验证弹窗
  const openCategoryActionAuth = (action: 'edit' | 'delete', categoryId: string, categoryName: string) => {
    setCategoryActionAuth({
      isOpen: true,
      action,
      categoryId,
      categoryName
    });
  };

  // 关闭分类操作验证弹窗
  const closeCategoryActionAuth = () => {
    setCategoryActionAuth({
      isOpen: false,
      action: 'edit',
      categoryId: '',
      categoryName: ''
    });
  };

  const handleImportConfirm = (newLinks: LinkItem[], newCategories: Category[]) => {
    // Merge categories: Avoid duplicate names/IDs
    const mergedCategories = [...categories];

    // 确保"常用推荐"分类始终存在
    if (!mergedCategories.some(c => c.id === 'common')) {
      mergedCategories.push({ id: 'common', name: '常用推荐', icon: 'Star' });
    }

    newCategories.forEach(nc => {
      if (!mergedCategories.some(c => c.id === nc.id || c.name === nc.name)) {
        mergedCategories.push(nc);
      }
    });

    const mergedLinks = [...links, ...newLinks];
    updateData(mergedLinks, mergedCategories);
    setIsImportModalOpen(false);
    alert(`成功导入 ${newLinks.length} 个新书签!`);
  };

  const handleAddLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    // 获取当前分类下的所有链接（不包括置顶链接）
    const categoryLinks = links.filter(link =>
      !link.pinned && (data.categoryId === 'all' || link.categoryId === data.categoryId)
    );



    const newLink: LinkItem = {
      ...data,
      url: processedUrl, // 使用处理后的URL
      id: Date.now().toString(),
      createdAt: Date.now(),
      // 如果是置顶链接，设置pinnedOrder为当前置顶链接数量
      pinnedOrder: data.pinned ? links.filter(l => l.pinned).length : undefined
    };

    // 将新链接插入到合适的位置，而不是直接放在开头
    // 如果是置顶链接，放在置顶链接区域的最后
    if (newLink.pinned) {
      const firstNonPinnedIndex = links.findIndex(link => !link.pinned);
      if (firstNonPinnedIndex === -1) {
        // 如果没有非置顶链接，直接添加到末尾
        updateData([...links, newLink], categories);
      } else {
        // 插入到非置顶链接之前
        const updatedLinks = [...links];
        updatedLinks.splice(firstNonPinnedIndex, 0, newLink);
        updateData(updatedLinks, categories);
      }
    } else {
      // 非置顶链接，按照order字段排序后插入
      const updatedLinks = [...links, newLink].sort((a, b) => {
        // 置顶链接始终排在前面
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // 同类型链接按照order排序
        const aOrder = a.order !== undefined ? a.order : a.createdAt;
        const bOrder = b.order !== undefined ? b.order : b.createdAt;
        return aOrder - bOrder;
      });
      updateData(updatedLinks, categories);
    }

    // Clear prefill if any
    setPrefillLink(undefined);
  };

  const handleEditLink = (data: Omit<LinkItem, 'id' | 'createdAt'>) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (!editingLink) return;

    // 处理URL，确保有协议前缀
    let processedUrl = data.url;
    if (processedUrl && !processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    const updated = links.map(l => l.id === editingLink.id ? { ...l, ...data, url: processedUrl } : l);
    updateData(updated, categories);
    setEditingLink(undefined);
  };

  // 拖拽结束事件处理函数
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 找到被拖拽元素和目标元素在links数组中的索引
      const activeIndex = links.findIndex(link => link.id === active.id);
      const overIndex = links.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        // 直接重新排序links数组
        const updatedLinks = arrayMove(links, activeIndex, overIndex);
        updateData(updatedLinks, categories);
      }
    }
  };

  // 置顶链接拖拽结束事件处理函数
  const handlePinnedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // 获取所有置顶链接
      const pinnedLinksList = links.filter(link => link.pinned);

      // 找到被拖拽元素和目标元素的索引
      const activeIndex = pinnedLinksList.findIndex(link => link.id === active.id);
      const overIndex = pinnedLinksList.findIndex(link => link.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        // 重新排序置顶链接
        const reorderedPinnedLinks = arrayMove(pinnedLinksList, activeIndex, overIndex);

        // 创建一个映射，存储每个置顶链接的新pinnedOrder
        const pinnedOrderMap = new Map<string, number>();
        reorderedPinnedLinks.forEach((link, index) => {
          pinnedOrderMap.set(link.id, index);
        });

        // 只更新置顶链接的pinnedOrder，不改变任何链接的顺序
        const updatedLinks = links.map(link => {
          if (link.pinned) {
            return {
              ...link,
              pinnedOrder: pinnedOrderMap.get(link.id)
            };
          }
          return link;
        });

        // 按照pinnedOrder重新排序整个链接数组，确保置顶链接的顺序正确
        // 同时保持非置顶链接的相对顺序不变
        updatedLinks.sort((a, b) => {
          // 如果都是置顶链接，按照pinnedOrder排序
          if (a.pinned && b.pinned) {
            return (a.pinnedOrder || 0) - (b.pinnedOrder || 0);
          }
          // 如果只有一个是置顶链接，置顶链接排在前面
          if (a.pinned) return -1;
          if (b.pinned) return 1;
          // 如果都不是置顶链接，保持原位置不变（按照order或createdAt排序）
          const aOrder = a.order !== undefined ? a.order : a.createdAt;
          const bOrder = b.order !== undefined ? b.order : b.createdAt;
          return bOrder - aOrder;
        });

        updateData(updatedLinks, categories);
      }
    }
  };

  // 开始排序
  const startSorting = (categoryId: string) => {
    setIsSortingMode(categoryId);
  };

  // 保存排序
  const saveSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingMode(null);
  };

  // 取消排序
  const cancelSorting = () => {
    setIsSortingMode(null);
  };

  // 保存置顶链接排序
  const savePinnedSorting = () => {
    // 在保存排序时，确保将当前排序后的数据保存到服务器和本地存储
    updateData(links, categories);
    setIsSortingPinned(false);
  };

  // 取消置顶链接排序
  const cancelPinnedSorting = () => {
    setIsSortingPinned(false);
  };

  // 设置dnd-kit的传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要拖动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteLink = (id: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    if (confirm('确定删除此链接吗?')) {
      updateData(links.filter(l => l.id !== id), categories);
    }
  };

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!authToken) { setIsAuthOpen(true); return; }

    const linkToToggle = links.find(l => l.id === id);
    if (!linkToToggle) return;

    // 如果是设置为置顶，则设置pinnedOrder为当前置顶链接数量
    // 如果是取消置顶，则清除pinnedOrder
    const updated = links.map(l => {
      if (l.id === id) {
        const isPinned = !l.pinned;
        return {
          ...l,
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined
        };
      }
      return l;
    });

    updateData(updated, categories);
  };

  const handleSavePasswordExpiryConfig = async (config: PasswordExpiryConfig) => {
    setPasswordExpiryConfig(config);

    // 保存到云端
    if (authToken) {
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'website',
            config: {
              passwordExpiry: config
            }
          })
        });

        if (!response.ok) {
          console.error('Failed to save password expiry config');
        }
      } catch (error) {
        console.error('Error saving password expiry config:', error);
      }
    }
  };

  // 保存网站自定义配置
  const handleSaveSiteConfig = async (config: SiteConfig) => {
    setSiteConfig(config);

    // 应用网站标题
    if (config.websiteTitle) {
      document.title = config.websiteTitle;
    }

    // 应用网站图标
    if (config.faviconUrl) {
      const existingFavicons = document.querySelectorAll('link[rel="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = config.faviconUrl;
      document.head.appendChild(favicon);
    }

    // 保存到云端
    if (authToken) {
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'site',
            config: config
          })
        });

        if (!response.ok) {
          console.error('Failed to save site config');
        }
      } catch (error) {
        console.error('Error saving site config:', error);
      }
    }
  };



  // --- Category Management & Security ---

  const handleCategoryClick = (cat: Category) => {
    // If category has password and is NOT unlocked
    if (cat.password && !unlockedCategoryIds.has(cat.id)) {
      setCatAuthModalData(cat);
      return;
    }
    // Scroll to category section logic could be added here
  };

  const handleUnlockCategory = (catId: string) => {
    setUnlockedCategoryIds(prev => new Set(prev).add(catId));
    setSelectedCategory(catId);
  };

  const handleUpdateCategories = (newCats: Category[]) => {
    if (!authToken) { setIsAuthOpen(true); return; }
    updateData(links, newCats);
  };

  const handleDeleteCategory = (catId: string) => {
    if (!authToken) { setIsAuthOpen(true); return; }

    // 防止删除"常用推荐"分类
    if (catId === 'common') {
      alert('"常用推荐"分类不能被删除');
      return;
    }

    let newCats = categories.filter(c => c.id !== catId);

    // 检查是否存在"常用推荐"分类，如果不存在则创建它
    if (!newCats.some(c => c.id === 'common')) {
      newCats = [
        { id: 'common', name: '常用推荐', icon: 'Star' },
        ...newCats
      ];
    }

    // Move links to common or first available
    const targetId = 'common';
    const newLinks = links.map(l => l.categoryId === catId ? { ...l, categoryId: targetId } : l);

    updateData(newLinks, newCats);
  };

  // --- WebDAV Config ---
  const handleSaveWebDavConfig = (config: WebDavConfig) => {
    setWebDavConfig(config);
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  };

  // 搜索源选择弹出窗口状态
  const [showSearchSourcePopup, setShowSearchSourcePopup] = useState(false);
  const [hoveredSearchSource, setHoveredSearchSource] = useState<ExternalSearchSource | null>(null);
  const [selectedSearchSource, setSelectedSearchSource] = useState<ExternalSearchSource | null>(null);
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [isPopupHovered, setIsPopupHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理弹出窗口显示/隐藏逻辑
  useEffect(() => {
    if (isIconHovered || isPopupHovered) {
      // 如果图标或弹出窗口被悬停，清除隐藏定时器并显示弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowSearchSourcePopup(true);
    } else {
      // 如果图标和弹出窗口都没有被悬停，设置一个延迟隐藏弹出窗口
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowSearchSourcePopup(false);
        setHoveredSearchSource(null);
      }, 100);
    }

    // 清理函数
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isIconHovered, isPopupHovered]);

  // 处理搜索源选择
  const handleSearchSourceSelect = async (source: ExternalSearchSource) => {
    // 更新选中的搜索源
    setSelectedSearchSource(source);

    // 保存选中的搜索源到KV空间
    await handleSaveSearchConfig(externalSearchSources, searchMode, source);

    if (searchQuery.trim()) {
      const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
      window.open(searchUrl, '_blank');
    }
    setShowSearchSourcePopup(false);
    setHoveredSearchSource(null);
  };

  // Time Greeting
  const getStatusGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '夜深了，注意休息';
    if (hour < 9) return '早安，新的一天';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了，早点休息';
  };

  // --- Search Config ---
  const handleSaveSearchConfig = async (sources: ExternalSearchSource[], mode: SearchMode, selectedSource?: ExternalSearchSource | null) => {
    const searchConfig: SearchConfig = {
      mode,
      externalSources: sources,
      selectedSource: selectedSource !== undefined ? selectedSource : selectedSearchSource
    };

    setExternalSearchSources(sources);
    setSearchMode(mode);
    if (selectedSource !== undefined) {
      setSelectedSearchSource(selectedSource);
    }

    // 只保存到KV空间（搜索配置允许无密码访问）
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // 如果有认证令牌，添加认证头
      if (authToken) {
        headers['x-auth-password'] = authToken;
      }

      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          saveConfig: 'search',
          config: searchConfig
        })
      });

      if (!response.ok) {
        console.error('Failed to save search config to KV:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving search config to KV:', error);
    }
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);

    // 如果切换到外部搜索模式且搜索源列表为空，自动加载默认搜索源
    if (mode === 'external' && externalSearchSources.length === 0) {
      const defaultSources = createSearchSources();

      // 保存默认搜索源到状态和KV空间
      handleSaveSearchConfig(defaultSources, mode);
    } else {
      handleSaveSearchConfig(externalSearchSources, mode);
    }
  };

  const handleExternalSearch = () => {
    if (searchQuery.trim() && searchMode === 'external') {
      // 如果搜索源列表为空，自动加载默认搜索源
      if (externalSearchSources.length === 0) {
        const defaultSources = createSearchSources();

        // 保存默认搜索源到状态和KV空间
        handleSaveSearchConfig(defaultSources, 'external');

        // 使用第一个默认搜索源立即执行搜索
        const searchUrl = defaultSources[0].url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
        return;
      }

      // 如果有选中的搜索源，使用选中的搜索源；否则使用第一个启用的搜索源
      let source = selectedSearchSource;
      if (!source) {
        const enabledSources = externalSearchSources.filter(s => s.enabled);
        if (enabledSources.length > 0) {
          source = enabledSources[0];
        }
      }

      if (source) {
        const searchUrl = source.url.replace('{query}', encodeURIComponent(searchQuery));
        window.open(searchUrl, '_blank');
      }
    }
  };

  const handleRestoreBackup = (restoredLinks: LinkItem[], restoredCategories: Category[]) => {
    updateData(restoredLinks, restoredCategories);
    setIsBackupModalOpen(false);
  };

  const handleRestoreSearchConfig = (restoredSearchConfig: SearchConfig) => {
    handleSaveSearchConfig(restoredSearchConfig.externalSources, restoredSearchConfig.mode);
  };

  // --- Filtering & Memo ---

  // Helper to check if a category is "Locked" (Has password AND not unlocked)
  const isCategoryLocked = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !cat.password) return false;
    return !unlockedCategoryIds.has(catId);
  };

  const pinnedLinks = useMemo(() => {
    // Don't show pinned links if they belong to a locked category
    const filteredPinnedLinks = links.filter(l => l.pinned && !isCategoryLocked(l.categoryId));
    // 按照pinnedOrder字段排序，如果没有pinnedOrder字段则按创建时间排序
    return filteredPinnedLinks.sort((a, b) => {
      // 如果有pinnedOrder字段，则使用pinnedOrder排序
      if (a.pinnedOrder !== undefined && b.pinnedOrder !== undefined) {
        return a.pinnedOrder - b.pinnedOrder;
      }
      // 如果只有一个有pinnedOrder字段，有pinnedOrder的排在前面
      if (a.pinnedOrder !== undefined) return -1;
      if (b.pinnedOrder !== undefined) return 1;
      // 如果都没有pinnedOrder字段，则按创建时间排序
      return a.createdAt - b.createdAt;
    });
  }, [links, categories, unlockedCategoryIds]);

  const displayedLinks = useMemo(() => {
    let result = links;

    // Security Filter: Always hide links from locked categories
    result = result.filter(l => !isCategoryLocked(l.categoryId));

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q))
      );
    }

    // 按照order字段排序，如果没有order字段则按创建时间排序
    // 修改排序逻辑：order值越大排在越前面，新增的卡片order值最大，会排在最前面
    // 我们需要反转这个排序，让新增的卡片(order值最大)排在最后面
    return result.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : a.createdAt;
      const bOrder = b.order !== undefined ? b.order : b.createdAt;
      // 改为升序排序，这样order值小(旧卡片)的排在前面，order值大(新卡片)的排在后面
      return aOrder - bOrder;
    });
  }, [links, searchQuery, categories, unlockedCategoryIds]);


  // --- Render Components ---

  // SortableLinkCard 组件已移至 components/SortableLinkCard.tsx

  const renderLinkCard = (link: LinkItem) => {
    const isSelected = selectedLinks.has(link.id);

    // 固定使用简约模式
    const isDetailedView = false;

    return (
      <div
        key={link.id}
        className={`group relative transition-all duration-300 ease-out hover:shadow-xl hover:shadow-blue-200/60 dark:hover:shadow-blue-900/30 hover:-translate-y-0.5 hover:scale-[1.02] ${isSelected
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          } ${isBatchEditMode ? 'cursor-pointer' : ''} ${isDetailedView
            ? 'flex flex-col rounded-2xl border shadow-sm p-4 min-h-[100px] hover:border-blue-400 dark:hover:border-blue-500'
            : 'flex items-center justify-between rounded-xl border shadow-sm p-3 hover:border-blue-400 dark:hover:border-blue-500'
          }`}
        onClick={() => isBatchEditMode && toggleLinkSelection(link.id)}
        onContextMenu={(e) => handleContextMenu(e, link)}
      >
        {/* 链接内容 - 在批量编辑模式下不使用a标签 */}
        {isBatchEditMode ? (
          <div className={`flex flex-1 min-w-0 overflow-hidden h-full ${isDetailedView ? 'flex-col' : 'items-center'
            }`}>
            {/* 第一行：图标和标题水平排列 */}
            <div className={`flex items-center gap-3 w-full`}>
              {/* Icon */}
              <div className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${isDetailedView ? 'w-8 h-8 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800' : 'w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700'
                }`}>
                {link.icon ? (
                  <img
                    src={link.icon}
                    alt=""
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;
                      if (target.src !== googleFaviconUrl) {
                        target.src = googleFaviconUrl;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                ) : (
                  link.title.charAt(0)
                )}
              </div>

              {/* 标题 */}
              <h3 className={`text-slate-900 dark:text-slate-100 truncate overflow-hidden text-ellipsis ${isDetailedView ? 'text-base' : 'text-sm font-medium text-slate-800 dark:text-slate-200'
                }`}>
                {link.title}
              </h3>
            </div>

            {/* 第二行：描述文字 */}
            {isDetailedView && link.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                {link.description}
              </p>
            )}
          </div>
        ) : (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-1 min-w-0 overflow-hidden h-full ${isDetailedView ? 'flex-col' : 'items-center'
              }`}
          >
            {/* 第一行：图标和标题水平排列 */}
            <div className={`flex items-center gap-3 w-full`}>
              {/* Icon */}
              <div className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${isDetailedView ? 'w-8 h-8 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800' : 'w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700'
                }`}>
                {link.icon ? (
                  <img
                    src={link.icon}
                    alt=""
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;
                      if (target.src !== googleFaviconUrl) {
                        target.src = googleFaviconUrl;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                ) : (
                  link.title.charAt(0)
                )}
              </div>

              {/* 标题 */}
              <h3 className={`text-slate-800 dark:text-slate-200 truncate whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${isDetailedView ? 'text-base' : 'text-sm font-medium'
                }`}>
                {link.title}
              </h3>
            </div>

            {/* 第二行：描述文字 */}
            {isDetailedView && link.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                {link.description}
              </p>
            )}
          </a>
        )}

      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-50">
      {/* 认证遮罩层 - 当需要认证时显示 */}
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

      {/* 主要内容 - 只有在不需要认证或已认证时显示 */}
      {(!requiresAuth || authToken) && (
        <>
          <AuthModal isOpen={isAuthOpen} onLogin={handleLogin} />

          <CategoryAuthModal
            isOpen={!!catAuthModalData}
            category={catAuthModalData}
            onClose={() => setCatAuthModalData(null)}
            onUnlock={handleUnlockCategory}
          />

          <CategoryManagerModal
            isOpen={isCatManagerOpen}
            onClose={() => setIsCatManagerOpen(false)}
            categories={categories}
            onUpdateCategories={handleUpdateCategories}
            onDeleteCategory={handleDeleteCategory}
            onVerifyPassword={handleCategoryActionAuth}
          />

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

          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            existingLinks={links}
            categories={categories}
            onImport={handleImportConfirm}
            onImportSearchConfig={handleRestoreSearchConfig}
          />

          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            passwordExpiryConfig={passwordExpiryConfig}
            onSavePasswordExpiry={handleSavePasswordExpiryConfig}
            siteConfig={siteConfig}
            onSaveSiteConfig={handleSaveSiteConfig}
          />

          <SearchConfigModal
            isOpen={isSearchConfigModalOpen}
            onClose={() => setIsSearchConfigModalOpen(false)}
            sources={externalSearchSources}
            onSave={(sources) => handleSaveSearchConfig(sources, searchMode)}
          />

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto relative w-full">

            {/* Header */}
            <header className="h-16 px-4 lg:px-6 flex items-center justify-between bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-6">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {siteConfig.navigationName || 'CloudNav'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* 视图切换控制器 */}

                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                  title="设置"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsImportModalOpen(true); }}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 transition-all"
                >
                  <Upload size={14} /> 导入
                </button>
                <button
                  onClick={() => { if (!authToken) setIsAuthOpen(true); else setIsCatManagerOpen(true); }}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 transition-all"
                >
                  <Settings size={14} /> 分类
                </button>
              </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 space-y-8 scroll-smooth">

              {/* Hero Search Section */}
              <section className="flex flex-col items-center justify-center py-12 md:py-20 animate-in fade-in zoom-in duration-500">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {getStatusGreeting()}
                </h1>

                {/* 搜索框 */}
                <div className="relative w-full max-w-2xl mx-auto shadow-xl shadow-blue-500/10 rounded-full group focus-within:shadow-2xl focus-within:shadow-blue-500/20 transition-all">
                  {/* 搜索源选择弹出窗口 */}
                  {showSearchSourcePopup && (
                    <div
                      className="absolute left-0 top-full mt-4 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2"
                      onMouseEnter={() => setIsPopupHovered(true)}
                      onMouseLeave={() => setIsPopupHovered(false)}
                    >
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                        {externalSearchSources
                          .filter(source => source.enabled)
                          .map((source, index) => (
                            <button
                              key={index}
                              onClick={() => handleSearchSourceSelect(source)}
                              onMouseEnter={() => setHoveredSearchSource(source)}
                              onMouseLeave={() => setHoveredSearchSource(null)}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors group/item"
                            >
                              <div className="p-2 bg-white dark:bg-slate-600 rounded-lg shadow-sm border border-slate-100 dark:border-slate-500 group-hover/item:scale-110 transition-transform">
                                <img
                                  src={`https://www.faviconextractor.com/favicon/${new URL(source.url).hostname}?larger=true`}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`;
                                  }}
                                  alt={source.name}
                                  className="w-5 h-5"
                                />
                              </div>
                              <span className="text-xs font-medium truncate w-full text-center">{source.name}</span>
                            </button>
                          ))}
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
                    {(hoveredSearchSource || selectedSearchSource) ? (
                      <img
                        src={`https://www.faviconextractor.com/favicon/${new URL((hoveredSearchSource || selectedSearchSource).url).hostname}?larger=true`}
                        alt={(hoveredSearchSource || selectedSearchSource).name}
                        className="w-6 h-6"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://www.google.com/s2/favicons?domain=${new URL((hoveredSearchSource || selectedSearchSource).url).hostname}&sz=32`;
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
                      if (e.key === 'Enter') {
                        if (selectedSearchSource) {
                          const searchUrl = selectedSearchSource.url.replace('{query}', encodeURIComponent(searchQuery));
                          window.open(searchUrl, '_blank');
                        }
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

              {/* 搜索结果 (如果正在搜索且有结果) */}
              {searchQuery.trim() && displayedLinks.length > 0 ? (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="text-blue-500" size={24} />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">搜索结果</h2>
                    <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{displayedLinks.length}</span>
                  </div>
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                    {displayedLinks.map(link => renderLinkCard(link))}
                  </div>
                </section>
              ) : searchQuery.trim() && displayedLinks.length === 0 ? (
                <section className="py-12 text-center">
                  <Search className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                  <p className="text-slate-500 dark:text-slate-400">没有找到匹配的链接</p>
                </section>
              ) : (
                <>
                  {/* 置顶区域 */}


                  {/* 分类循环 */}
                  {categories.map((cat, index) => {
                    // Filter links for this category
                    const catLinks = links
                      .filter(l => l.categoryId === cat.id)
                      .sort((a, b) => {
                        const aOrder = a.order !== undefined ? a.order : a.createdAt;
                        const bOrder = b.order !== undefined ? b.order : b.createdAt;
                        return aOrder - bOrder;
                      });

                    const isLocked = cat.password && !unlockedCategoryIds.has(cat.id);

                    if (catLinks.length === 0 && !isAuthenticated) return null; // Skip empty categories if not admin (optional)

                    return (
                      <section key={cat.id} id={`cat-${cat.id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className="flex items-center justify-between gap-2 mb-4 group">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                              <Icon name={cat.icon} size={18} />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{cat.name}</h2>
                            {isLocked && <Lock size={14} className="text-amber-500" />}
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{catLinks.length}</span>
                          </div>

                          <button
                            onClick={() => { setEditingLink(undefined); setPrefillLink({ categoryId: cat.id }); setIsModalOpen(true); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                            title="在此分类添加链接"
                          >
                            <Plus size={18} />
                          </button>
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
                          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                            {catLinks.map(link => renderLinkCard(link))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </main>

          <LinkModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingLink(undefined); setPrefillLink(undefined); }}
            onSave={editingLink ? handleEditLink : handleAddLink}
            onDelete={editingLink ? handleDeleteLink : undefined}
            categories={categories}
            initialData={editingLink || (prefillLink as LinkItem)}

            defaultCategoryId={selectedCategory !== 'all' ? selectedCategory : undefined}
          />

          {/* 右键菜单 */}
          <ContextMenu
            isOpen={contextMenu.isOpen}
            position={contextMenu.position}
            onClose={closeContextMenu}
            onCopyLink={copyLinkToClipboard}
            onShowQRCode={showQRCode}
            onEditLink={editLinkFromContextMenu}
            onDeleteLink={deleteLinkFromContextMenu}
            onTogglePin={togglePinFromContextMenu}
          />

          {/* 二维码模态框 */}
          <QRCodeModal
            isOpen={qrCodeModal.isOpen}
            url={qrCodeModal.url || ''}
            title={qrCodeModal.title || ''}
            onClose={() => setQrCodeModal({ isOpen: false, url: '', title: '' })}
          />
        </>
      )}
    </div>
  );
}

export default App;

