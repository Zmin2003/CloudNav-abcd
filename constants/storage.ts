// 本地存储键名常量
export const STORAGE_KEYS = {
  /** 数据缓存 */
  LOCAL_DATA: 'cloudnav_data_cache',
  /** 认证令牌 */
  AUTH_TOKEN: 'cloudnav_auth_token',
  /** WebDAV 配置 */
  WEBDAV_CONFIG: 'cloudnav_webdav_config',
  /** 搜索配置 */
  SEARCH_CONFIG: 'cloudnav_search_config',
  /** 主题设置 */
  THEME: 'theme',
} as const;

// GitHub 仓库地址
export const GITHUB_REPO_URL = 'https://github.com/aabacada/CloudNav-abcd';

// API 端点
export const API_ENDPOINTS = {
  STORAGE: '/api/storage',
} as const;

// 主题模式
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

// 同步状态
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

// 排序模式
export type SortingMode = string | null;
