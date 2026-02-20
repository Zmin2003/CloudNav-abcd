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
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      target.style.display = 'none';
      return;
    }
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
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
 * 对输入进行安全检查
 */
export const applySiteConfig = (config: { websiteTitle?: string; faviconUrl?: string }) => {
  if (config.websiteTitle && typeof config.websiteTitle === 'string') {
    // 限制标题长度，防止 DOM 操作风险
    document.title = config.websiteTitle.slice(0, 200);
  }
  if (config.faviconUrl && typeof config.faviconUrl === 'string') {
    // 验证 favicon URL 格式
    try {
      const parsed = new URL(config.faviconUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
    } catch {
      return;
    }
    const existingFavicons = document.querySelectorAll('link[rel="icon"]');
    existingFavicons.forEach(favicon => favicon.remove());
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = config.faviconUrl;
    document.head.appendChild(favicon);
  }
};
