import { useState, useCallback } from 'react';
import { LinkItem, Category } from '../types';
import { STORAGE_KEYS } from '../constants';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 数据同步 Hook
 * 处理本地存储和云端同步
 */
export function useSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // 保存到本地存储
  const saveToLocal = useCallback((links: LinkItem[], categories: Category[]) => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_DATA,
      JSON.stringify({ links, categories })
    );
  }, []);

  // 从本地存储加载
  const loadFromLocal = useCallback((): { links: LinkItem[]; categories: Category[] } | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_DATA);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
    return null;
  }, []);

  // 同步到云端
  const syncToCloud = useCallback(
    async (
      links: LinkItem[],
      categories: Category[],
      authToken: string,
      onAuthFailed?: () => void
    ): Promise<boolean> => {
      setSyncStatus('saving');
      try {
        const response = await fetch('/api/storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-password': authToken,
          },
          body: JSON.stringify({ links, categories }),
        });

        if (response.status === 401) {
          // 检查是否是密码过期
          try {
            const errorData = await response.json();
            if (errorData.error && errorData.error.includes('过期')) {
              alert('您的密码已过期，请重新登录');
            }
          } catch {
            // 忽略解析错误
          }
          onAuthFailed?.();
          setSyncStatus('error');
          return false;
        }

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
      } catch (error) {
        console.error('Sync failed:', error);
        setSyncStatus('error');
        return false;
      }
    },
    []
  );

  // 从云端加载
  const loadFromCloud = useCallback(
    async (authToken: string): Promise<{ links: LinkItem[]; categories: Category[] } | null> => {
      try {
        const response = await fetch('/api/storage', {
          headers: {
            'x-auth-password': authToken,
          },
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        if (data.links && data.categories) {
          return { links: data.links, categories: data.categories };
        }
      } catch (error) {
        console.error('Error loading from cloud:', error);
      }
      return null;
    },
    []
  );

  return {
    syncStatus,
    setSyncStatus,
    saveToLocal,
    loadFromLocal,
    syncToCloud,
    loadFromCloud,
  };
}
