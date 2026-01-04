import { ExternalSearchSource } from '../types';

/**
 * 默认外部搜索源配置
 * 用于初始化搜索功能，避免重复定义
 */
export const DEFAULT_SEARCH_SOURCES: Omit<ExternalSearchSource, 'createdAt'>[] = [
  {
    id: 'bing',
    name: '必应',
    url: 'https://www.bing.com/search?q={query}',
    icon: 'Search',
    enabled: true,
  },
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q={query}',
    icon: 'Search',
    enabled: true,
  },
  {
    id: 'baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd={query}',
    icon: 'Globe',
    enabled: true,
  },
  {
    id: 'sogou',
    name: '搜狗',
    url: 'https://www.sogou.com/web?query={query}',
    icon: 'Globe',
    enabled: true,
  },
  {
    id: 'yandex',
    name: 'Yandex',
    url: 'https://yandex.com/search/?text={query}',
    icon: 'Globe',
    enabled: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/search?q={query}',
    icon: 'Github',
    enabled: true,
  },
  {
    id: 'linuxdo',
    name: 'Linux.do',
    url: 'https://linux.do/search?q={query}',
    icon: 'Terminal',
    enabled: true,
  },
  {
    id: 'bilibili',
    name: 'B站',
    url: 'https://search.bilibili.com/all?keyword={query}',
    icon: 'Play',
    enabled: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/results?search_query={query}',
    icon: 'Video',
    enabled: true,
  },
  {
    id: 'wikipedia',
    name: '维基',
    url: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}',
    icon: 'BookOpen',
    enabled: true,
  },
];

/**
 * 创建带时间戳的搜索源列表
 */
export function createSearchSources(): ExternalSearchSource[] {
  const now = Date.now();
  return DEFAULT_SEARCH_SOURCES.map((source) => ({
    ...source,
    createdAt: now,
  }));
}
