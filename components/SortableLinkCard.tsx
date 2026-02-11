import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LinkItem } from '../types';

interface SortableLinkCardProps {
  link: LinkItem;
  isSortingMode: boolean;
  isSortingPinned: boolean;
}

/**
 * 可排序的链接卡片组件
 * 用于拖拽排序场景
 */
export const SortableLinkCard: React.FC<SortableLinkCardProps> = React.memo(({
  link,
  isSortingMode,
  isSortingPinned,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  // 固定使用简约模式
  const isDetailedView = false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative transition-all duration-200 cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 ${
        isSortingMode || isSortingPinned
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
      } ${isDragging ? 'shadow-2xl scale-105' : ''} ${
        isDetailedView
          ? 'flex flex-col rounded-2xl border shadow-sm p-4 min-h-[100px] hover:border-blue-400 dark:hover:border-blue-500'
          : 'flex items-center rounded-xl border shadow-sm hover:border-blue-300 dark:hover:border-blue-600'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* 链接内容 - 移除a标签，改为div防止点击跳转 */}
      <div
        className={`flex flex-1 min-w-0 overflow-hidden ${
          isDetailedView ? 'flex-col' : 'items-center gap-3'
        }`}
      >
        {/* 第一行：图标和标题水平排列 */}
        <div
          className={`flex items-center gap-3 mb-2 ${
            isDetailedView ? '' : 'w-full'
          }`}
        >
          {/* Icon */}
          <div
            className={`text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 ${
              isDetailedView
                ? 'w-8 h-8 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800'
                : 'w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700'
            }`}
          >
            {link.icon ? (
              <img
                src={link.icon}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;
                  if (target.src !== googleFaviconUrl) {
                    target.src = googleFaviconUrl;
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
            ) : (
              link.title.charAt(0)
            )}
          </div>

          {/* 标题 */}
          <h3
            className={`text-slate-900 dark:text-slate-100 truncate overflow-hidden text-ellipsis ${
              isDetailedView
                ? 'text-base'
                : 'text-sm font-medium text-slate-800 dark:text-slate-200'
            }`}
          >
            {link.title}
          </h3>
        </div>

        {/* 第二行：描述文字 */}
      </div>
    </div>
  );
});

SortableLinkCard.displayName = 'SortableLinkCard';

export default SortableLinkCard;
