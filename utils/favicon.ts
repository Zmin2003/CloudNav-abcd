import React from 'react';

/**
 * Favicon 图片加载失败时的统一降级处理
 * 先尝试 Google favicon 服务，再隐藏图片
 */
export const handleFaviconError = (
  e: React.SyntheticEvent<HTMLImageElement>,
  url: string
) => {
  const target = e.target as HTMLImageElement;
  try {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
    if (target.src !== googleFaviconUrl) {
      target.src = googleFaviconUrl;
    } else {
      target.style.display = 'none';
    }
  } catch {
    target.style.display = 'none';
  }
};

/**
 * 应用站点自定义配置（标题 + favicon）
 */
export const applySiteConfig = (config: { websiteTitle?: string; faviconUrl?: string }) => {
  if (config.websiteTitle) {
    document.title = config.websiteTitle;
  }
  if (config.faviconUrl) {
    const existingFavicons = document.querySelectorAll('link[rel="icon"]');
    existingFavicons.forEach(favicon => favicon.remove());
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = config.faviconUrl;
    document.head.appendChild(favicon);
  }
};
