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
      className="w-full h-full object-contain"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={(e) => handleFaviconError(e, link.url)}
    />
  ) : (
    <span className="flex items-center justify-center font-bold text-blue-500 dark:text-blue-400">
      {link.title.charAt(0).toUpperCase()}
    </span>
  );

  const content = (
    <div className="flex items-center gap-3 w-full p-3">
      {/* Icon */}
      <div className="w-10 h-10 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-110">
        {iconElement}
      </div>
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h3 className={`truncate text-sm font-semibold ${isBatchEditMode
          ? 'text-slate-900 dark:text-slate-100'
          : 'text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
          }`}>
          {link.title}
        </h3>
        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500 font-normal">
          {link.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className={`group relative touch-none-select hover-lift card-shimmer flex items-center justify-between rounded-2xl p-0.5 glass-link-card transition-all ${isSelected
        ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
        : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm'
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
        <span className="pinned-badge absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full shadow-sm z-10 border-2 border-white dark:border-slate-900" />
      )}

      {isBatchEditMode ? (
        <div className="flex-1 min-w-0 overflow-hidden">
          {content}
        </div>
      ) : (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 overflow-hidden"
          onClick={handleLinkClick}
        >
          {content}
        </a>
      )}
    </div>
  );
};

export default React.memo(LinkCard);
