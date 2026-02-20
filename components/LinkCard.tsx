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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // Synthesize a mouse event at the touch position for the context menu
      const touch = e.touches[0];
      const syntheticEvent = {
        preventDefault: () => { },
        stopPropagation: () => { },
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent;
      onContextMenu(syntheticEvent, link);
    }, 500);
  }, [link, onContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isBatchEditMode) {
      onToggleSelection(link.id);
    }
  }, [isBatchEditMode, link.id, onToggleSelection]);

  // 安全校验 URL，防止 javascript: 协议等 XSS
  const safeUrl = (() => {
    try {
      const parsed = new URL(link.url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return link.url;
      }
      return '#';
    } catch {
      return '#';
    }
  })();

  const iconElement = link.icon ? (
    <img
      src={link.icon}
      alt=""
      className="w-5 h-5 object-contain"
      onError={(e) => handleFaviconError(e, link.url)}
    />
  ) : (
    link.title.charAt(0)
  );

  const content = (
    <div className="flex items-center gap-3 w-full">
      {/* Icon */}
      <div className="text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 w-8 h-8 rounded-xl bg-white/40 dark:bg-slate-700/40 icon-hover-float backdrop-blur-md">
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
      key={link.id}
      className={`group relative touch-none-select card-shimmer card-glow-ring transition-all duration-300 ease-out hover:shadow-xl hover:shadow-blue-300/40 dark:hover:shadow-blue-900/40 hover:-translate-y-1 hover:scale-[1.03] flex items-center justify-between rounded-2xl shadow-sm p-3 hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98]
        bg-white/40 dark:bg-slate-800/50 backdrop-blur-2xl border border-white/60 dark:border-white/10 ${isSelected
          ? 'bg-red-50/70 border-red-300 dark:bg-red-900/40 dark:border-red-700'
          : 'border-white/40 dark:border-slate-600/50'
        } ${isBatchEditMode ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, link)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
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
          onClick={(e) => { if (longPressTriggered.current) e.preventDefault(); }}
        >
          {content}
        </a>
      )}
    </div>
  );
};

export default React.memo(LinkCard);
