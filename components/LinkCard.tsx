import React, { useRef, useCallback } from 'react';
import { LinkItem } from '../types';
import { handleFaviconError } from '../utils/favicon';

interface LinkCardProps {
  link: LinkItem;
  isBatchEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, link: LinkItem) => void;
}

/**
 * 链接卡片组件
 * 统一渲染普通模式和批量编辑模式下的链接卡片
 * 支持移动端长按触发右键菜单
 */
const LinkCard: React.FC<LinkCardProps> = ({
  link,
  isBatchEditMode,
  isSelected,
  onToggleSelection,
  onContextMenu,
}) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const cooldownUntil = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isBatchEditMode || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      cooldownUntil.current = Date.now() + 700;
      const syntheticEvent = {
        preventDefault: () => { },
        stopPropagation: () => { },
        clientX,
        clientY,
      } as React.MouseEvent;
      onContextMenu(syntheticEvent, link);
    }, 500);
  }, [isBatchEditMode, link, onContextMenu]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressTriggered.current = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (longPressTriggered.current || Date.now() < cooldownUntil.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isBatchEditMode) {
      onToggleSelection(link.id);
    }
  }, [isBatchEditMode, link.id, onToggleSelection]);

  // Validate URL safely
  const safeUrl = (() => {
    try {
      const normalized = link.url.startsWith('http://') || link.url.startsWith('https://')
        ? link.url
        : `https://${link.url}`;
      const parsed = new URL(normalized);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return normalized;
      }
      return '';
    } catch {
      return '';
    }
  })();

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    if (!safeUrl || longPressTriggered.current || Date.now() < cooldownUntil.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [safeUrl]);

  const iconElement = link.icon ? (
    <img
      src={link.icon}
      alt=""
      className="link-favicon-img"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={(e) => handleFaviconError(e, link.url)}
    />
  ) : (
    <span className="glass-link-fallback">{link.title.charAt(0).toUpperCase()}</span>
  );

  const content = (
    <div className="flex items-center gap-3 w-full">
      {/* Icon */}
      <div className="glass-link-icon text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold uppercase shrink-0 w-10 h-10 rounded-lg icon-hover-float">
        {iconElement}
      </div>
      {/* Title */}
      <h3 className={`truncate overflow-hidden text-ellipsis text-sm font-medium ${isBatchEditMode
        ? 'text-slate-900 dark:text-slate-100'
        : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
        }`}>
        {link.title}
      </h3>
    </div>
  );

  return (
    <div
      className={`group relative touch-none-select card-shimmer flex items-center justify-between rounded-lg shadow-sm p-3 glass-link-card card-touch-optimized transition-all ${isSelected
        ? 'glass-link-card-selected'
        : ''
        } ${isBatchEditMode ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, link)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchCancel}
    >
      {/* Pinned indicator */}
      {link.pinned && (
        <span className="pinned-badge absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50 z-10" />
      )}

      {isBatchEditMode ? (
        <div className="flex flex-1 min-w-0 overflow-hidden h-full items-center">
          {content}
        </div>
      ) : (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 min-w-0 overflow-hidden h-full items-center"
          onClick={handleLinkClick}
        >
          {content}
        </a>
      )}
    </div>
  );
};

export default React.memo(LinkCard);
