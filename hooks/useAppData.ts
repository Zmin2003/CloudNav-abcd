import { useState, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, PasswordExpiryConfig, SiteConfig, WebDavConfig } from '../types';
import { STORAGE_KEYS } from '../constants';
import { applySiteConfig } from '../utils/favicon';

const LOCAL_STORAGE_KEY = STORAGE_KEYS.LOCAL_DATA;
const WEBDAV_CONFIG_KEY = STORAGE_KEYS.WEBDAV_CONFIG;

// --- Helpers ---

/** 确保"常用推荐"分类始终存在且排在第一位 */
function ensureCommonCategory(cats: Category[]): Category[] {
  const common: Category = { id: 'common', name: '常用推荐', icon: 'Star' };
  const idx = cats.findIndex(c => c.id === 'common');
  if (idx < 0) return [common, ...cats];
  if (idx === 0) return cats;
  return [cats[idx], ...cats.slice(0, idx), ...cats.slice(idx + 1)];
}

/** 将不存在分类的链接迁移到"常用推荐" */
function migrateOrphanLinks(links: LinkItem[], categories: Category[]): LinkItem[] {
  const validIds = new Set(categories.map(c => c.id));
  return links.map(l => validIds.has(l.categoryId) ? l : { ...l, categoryId: 'common' });
}

/** 安全解析 URL hostname，不抛异常 */
export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // URL 含占位符 (如 {query}) 时会抛异常
    try {
      // 尝试替换占位符后再解析
      return new URL(url.replace(/\{[^}]+\}/g, 'placeholder')).hostname;
    } catch {
      return '';
    }
  }
}

/** 确保 URL 有协议前缀 */
export function ensureProtocol(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}

/** 提取 URL 域名 */
export function normalizeDomain(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 通用排序比较器：按 order > createdAt 升序 */
export function compareByOrder(a: LinkItem, b: LinkItem): number {
  const aOrder = a.order !== undefined ? a.order : a.createdAt;
  const bOrder = b.order !== undefined ? b.order : b.createdAt;
  return aOrder - bOrder;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAppDataReturn {
  // State
  links: LinkItem[];
  categories: Category[];
  syncStatus: SyncStatus;
  appDataVersion: number;
  webDavConfig: WebDavConfig;
  passwordExpiryConfig: PasswordExpiryConfig;
  siteConfig: SiteConfig;

  // Setters
  setLinks: Dispatch<SetStateAction<LinkItem[]>>;
  setCategories: Dispatch<SetStateAction<Category[]>>;
  setAppDataVersion: Dispatch<SetStateAction<number>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
  setPasswordExpiryConfig: Dispatch<SetStateAction<PasswordExpiryConfig>>;
  setSiteConfig: Dispatch<SetStateAction<SiteConfig>>;

  // Actions
  loadFromLocal: () => void;
  updateData: (links: LinkItem[], categories: Category[], authToken: string) => void;
  syncToCloud: (links: LinkItem[], categories: Category[], token: string) => Promise<boolean>;
  loadLinkIcons: (linksToLoad: LinkItem[], authToken: string) => Promise<void>;
  handleSaveWebDavConfig: (config: WebDavConfig) => void;
  handleSavePasswordExpiryConfig: (config: PasswordExpiryConfig, authToken: string) => Promise<void>;
  handleSaveSiteConfig: (config: SiteConfig, authToken: string) => Promise<void>;
}

export function useAppData(): UseAppDataReturn {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [appDataVersion, setAppDataVersion] = useState<number>(1);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
    url: '', username: '', password: '', enabled: false,
  });
  const [passwordExpiryConfig, setPasswordExpiryConfig] = useState<PasswordExpiryConfig>({
    value: 1, unit: 'week',
  });
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({});

  // 使用 ref 跟踪最新版本号，避免闭包过期
  const versionRef = useRef(appDataVersion);
  versionRef.current = appDataVersion;

  const loadFromLocal = useCallback(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      const cats = ensureCommonCategory(parsed.categories || DEFAULT_CATEGORIES);
      const lnks = migrateOrphanLinks(parsed.links || INITIAL_LINKS, cats);
      setLinks(lnks);
      setCategories(cats);
    } catch {
      setLinks(INITIAL_LINKS);
      setCategories(DEFAULT_CATEGORIES);
    }
  }, []);

  const syncToCloud = useCallback(async (
    newLinks: LinkItem[],
    newCategories: Category[],
    token: string,
  ): Promise<boolean> => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': token,
        },
        body: JSON.stringify({
          links: newLinks,
          categories: newCategories,
          baseVersion: versionRef.current,
        }),
      });

      if (response.status === 401) {
        try {
          const errorData = await response.json();
          if (errorData.error?.includes('过期')) {
            alert('您的密码已过期，请重新登录');
          }
        } catch { /* ignore */ }
        setSyncStatus('error');
        return false;
      }

      if (response.status === 409) {
        setSyncStatus('error');
        alert('检测到数据冲突：云端数据已更新，请刷新页面后重试。');
        return false;
      }

      if (!response.ok) throw new Error('Network response was not ok');

      try {
        const result = await response.json();
        if (typeof result?.version === 'number') {
          setAppDataVersion(result.version);
        }
      } catch { /* ignore */ }

      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } catch (error) {
      console.error('Sync failed', error);
      setSyncStatus('error');
      return false;
    }
  }, []);

  const updateData = useCallback((
    newLinks: LinkItem[],
    newCategories: Category[],
    authToken: string,
  ) => {
    setLinks(newLinks);
    setCategories(newCategories);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      links: newLinks, categories: newCategories,
    }));
    if (authToken) {
      syncToCloud(newLinks, newCategories, authToken);
    }
  }, [syncToCloud]);

  const fetchCachedFavicon = useCallback(async (domain: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.cached && data.icon ? data.icon : null;
    } catch {
      return null;
    }
  }, []);

  const loadLinkIcons = useCallback(async (linksToLoad: LinkItem[], authToken: string) => {
    if (!authToken || linksToLoad.length === 0) return;

    const domains = Array.from(new Set(
      linksToLoad
        .map(link => normalizeDomain(link.url))
        .filter((d): d is string => !!d)
    ));
    if (domains.length === 0) return;

    const iconByDomain = new Map<string, string>();
    const results = await Promise.allSettled(
      domains.map(async (domain) => {
        const icon = await fetchCachedFavicon(domain);
        return { domain, icon };
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.icon) {
        iconByDomain.set(result.value.domain, result.value.icon);
      }
    }
    if (iconByDomain.size === 0) return;

    setLinks(prev => prev.map(link => {
      const domain = normalizeDomain(link.url);
      if (!domain) return link;
      const cachedIcon = iconByDomain.get(domain);
      if (!cachedIcon) return link;
      if (!link.icon || link.icon.includes('faviconextractor.com') || !cachedIcon.includes('faviconextractor.com')) {
        return { ...link, icon: cachedIcon };
      }
      return link;
    }));
  }, [fetchCachedFavicon]);

  const handleSaveWebDavConfig = useCallback((config: WebDavConfig) => {
    setWebDavConfig(config);
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config));
  }, []);

  const handleSavePasswordExpiryConfig = useCallback(async (config: PasswordExpiryConfig, authToken: string) => {
    setPasswordExpiryConfig(config);
    if (!authToken) return;
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({ saveConfig: 'website', config: { passwordExpiry: config } }),
      });
      if (!response.ok) console.error('Failed to save password expiry config');
    } catch (error) {
      console.error('Error saving password expiry config:', error);
    }
  }, []);

  const handleSaveSiteConfig = useCallback(async (config: SiteConfig, authToken: string) => {
    setSiteConfig(config);
    applySiteConfig(config);
    if (!authToken) return;
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({ saveConfig: 'site', config }),
      });
      if (!response.ok) console.error('Failed to save site config');
    } catch (error) {
      console.error('Error saving site config:', error);
    }
  }, []);

  return {
    links, categories, syncStatus, appDataVersion, webDavConfig,
    passwordExpiryConfig, siteConfig,
    setLinks, setCategories, setSyncStatus, setAppDataVersion,
    setPasswordExpiryConfig, setSiteConfig,
    loadFromLocal, updateData, syncToCloud, loadLinkIcons,
    handleSaveWebDavConfig, handleSavePasswordExpiryConfig, handleSaveSiteConfig,
  };
}
