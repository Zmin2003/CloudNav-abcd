import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS, THEME_MODES } from '../constants';

/**
 * 主题管理 Hook
 * 处理深色/浅色模式切换和持久化
 */
export function useTheme() {
  const [darkMode, setDarkMode] = useState(false);

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === THEME_MODES.DARK || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // 切换主题
  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(STORAGE_KEYS.THEME, THEME_MODES.DARK);
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(STORAGE_KEYS.THEME, THEME_MODES.LIGHT);
      }
      return newMode;
    });
  }, []);

  return {
    darkMode,
    toggleTheme,
  };
}
