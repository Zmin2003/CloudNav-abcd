import React, { useState, useEffect } from 'react';
import { X, Loader2, Pin, Wand2, Trash2 } from 'lucide-react';
import { LinkItem, Category } from '../types';
import { STORAGE_KEYS } from '../constants';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Omit<LinkItem, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  categories: Category[];
  initialData?: LinkItem;
  defaultCategoryId?: string;
}

// Utility: Normalize and validate URL
function normalizeUrl(url: string): string | null {
  let normalized = url.trim();
  if (!normalized) return null;

  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

// Utility: Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const urlObj = new URL(normalized);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

// Favicon fallback sources in priority order
const FAVICON_SOURCES = [
  (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  (domain: string) => `https://www.faviconextractor.com/favicon/${domain}?larger=true`,
  (domain: string) => `https://${domain}/favicon.ico`,
];

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onSave, onDelete, categories, initialData, defaultCategoryId }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'common');
  const [pinned, setPinned] = useState(false);
  const [icon, setIcon] = useState('');
  const [isFetchingIcon, setIsFetchingIcon] = useState(false);
  const [autoFetchIcon, setAutoFetchIcon] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [error, setError] = useState('');

  // Reset batch mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setBatchMode(false);
      setShowSuccessMessage(false);
      setError('');
    }
  }, [isOpen]);

  // Auto-hide success message after 1 second
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setUrl(initialData.url);
        setCategoryId(initialData.categoryId);
        setPinned(initialData.pinned || false);
        setIcon(initialData.icon || '');
      } else {
        setTitle('');
        setUrl('');
        const defaultCategory = defaultCategoryId && categories.find(cat => cat.id === defaultCategoryId);
        setCategoryId(defaultCategory ? defaultCategoryId : (categories[0]?.id || 'common'));
        setPinned(false);
        setIcon('');
      }
    }
  }, [isOpen, initialData, categories, defaultCategoryId]);

  // Auto-fetch favicon when URL changes
  useEffect(() => {
    if (url && autoFetchIcon && !initialData) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        if (cancelled || !url) return;

        setIsFetchingIcon(true);
        try {
          const domain = extractDomain(url);
          if (!domain) {
            setIsFetchingIcon(false);
            return;
          }

          // Try to fetch from cache first
          try {
            const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.cached && data.icon) {
                if (!cancelled) setIcon(data.icon);
                return;
              }
            }
          } catch { /* ignore cache fetch error */ }

          // Use first favicon source as fallback
          if (!cancelled) {
            const iconUrl = FAVICON_SOURCES[0](domain);
            setIcon(iconUrl);
          }
        } catch {
          // Ignore errors
        } finally {
          if (!cancelled) setIsFetchingIcon(false);
        }
      }, 600);
      return () => { cancelled = true; clearTimeout(timer); };
    }
  }, [url, autoFetchIcon, initialData]);

  const handleDelete = () => {
    if (!initialData) return;
    onDelete && onDelete(initialData.id);
    onClose();
  };

  // Cache custom icon to KV storage
  const cacheCustomIcon = async (url: string, iconUrl: string) => {
    try {
      const domain = extractDomain(url);
      if (!domain) return;

      const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (authToken) {
        await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken
          },
          body: JSON.stringify({
            saveConfig: 'favicon',
            domain: domain,
            icon: iconUrl
          })
        });
      }
    } catch (error) {
      console.log("Failed to cache custom icon", error);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle || !trimmedUrl) {
      setError('标题和 URL 不能为空');
      return;
    }

    if (trimmedTitle.length > 500) {
      setError('标题过长，最大支持 500 个字符');
      return;
    }

    if (trimmedUrl.length > 2048) {
      setError('URL 过长，最大支持 2048 个字符');
      return;
    }

    const finalUrl = normalizeUrl(trimmedUrl);
    if (!finalUrl) {
      setError('URL 格式无效，请检查输入');
      return;
    }

    onSave({
      id: initialData?.id || '',
      title: trimmedTitle,
      url: finalUrl,
      icon,
      categoryId,
      pinned
    });

    // Cache custom icon if provided
    if (icon && !FAVICON_SOURCES.some(source => source('').includes(icon))) {
      cacheCustomIcon(finalUrl, icon);
    }

    if (batchMode) {
      setShowSuccessMessage(true);
      setTitle('');
      setUrl('');
      setIcon('');
      setPinned(false);
      setError('');
    } else {
      onClose();
    }
  };

  const handleFetchIcon = async () => {
    if (!url) return;

    setIsFetchingIcon(true);
    try {
      const domain = extractDomain(url);
      if (!domain) {
        setError('URL 格式无效');
        setIsFetchingIcon(false);
        return;
      }

      // Try cache first
      try {
        const response = await fetch(`/api/storage?getConfig=favicon&domain=${encodeURIComponent(domain)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.cached && data.icon) {
            setIcon(data.icon);
            setIsFetchingIcon(false);
            return;
          }
        }
      } catch (error) {
        console.log("Failed to fetch cached icon", error);
      }

      // Try multiple favicon sources
      const iconUrl = FAVICON_SOURCES[0](domain);
      setIcon(iconUrl);

      // Cache the icon
      await cacheCustomIcon(url, iconUrl);
    } catch (e) {
      console.error("Failed to fetch icon", e);
      setError('获取图标失败');
    } finally {
      setIsFetchingIcon(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 ios-modal-backdrop">
      <div className="ios-modal-panel rounded-t-2xl sm:rounded-3xl w-full sm:max-w-md max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto safe-area-bottom">
        <div className="ios-modal-header flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {initialData ? '编辑链接' : '添加新链接'}
            </h3>
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all ${pinned
                ? 'ios-chip-toggle-active text-blue-600 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300'
                }`}
              title={pinned ? "取消置顶" : "置顶"}
            >
              <Pin size={14} className={pinned ? "fill-current" : ""} />
              <span className="text-xs font-medium">置顶</span>
            </button>
            {!initialData && (
              <label className="ios-secondary-chip flex items-center gap-1 px-2.5 py-1.5 rounded-lg border cursor-pointer">
                <input
                  type="checkbox"
                  id="batchMode"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">批量添加</span>
              </label>
            )}
            {initialData && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="ios-danger-chip flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all text-red-600 hover:bg-red-100/60 dark:text-red-300"
                title="删除链接"
              >
                <Trash2 size={14} />
                <span className="text-xs font-medium">删除</span>
              </button>
            )}
          </div>
          <button onClick={onClose} className="ios-close-btn p-1.5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">标题</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="ios-input p-2.5 transition-all w-full"
              placeholder="网站名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL 链接</label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="ios-input p-2.5 transition-all w-full"
              placeholder="example.com 或 https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">图标 URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="ios-input flex-1 p-2.5 transition-all"
                placeholder="https://example.com/icon.png"
              />
              <button
                type="button"
                onClick={handleFetchIcon}
                disabled={!url || isFetchingIcon}
                className="ios-primary-btn px-3 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                {isFetchingIcon ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                获取
              </button>
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                id="autoFetchIcon"
                checked={autoFetchIcon}
                onChange={(e) => setAutoFetchIcon(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">自动获取图标</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">分类</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="ios-select p-2.5 transition-all w-full"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-2 relative">
            {showSuccessMessage && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg text-sm">
                添加成功
              </div>
            )}
            <button
              type="submit"
              className="ios-primary-wide-btn w-full text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkModal;
