import React from 'react';
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
 */
const LinkCard: React.FC<LinkCardProps> = ({
  link,
  isBatchEditMode,
  isSelected,
  onToggleSelection,
  onContextMenu,
}) => {
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
      <div className="text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold uppercase shrink-0 w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700">
        {iconElement}
      </div>
      {/* Title */}
      <h3 className={`truncate overflow-hidden text-ellipsis text-sm font-medium ${
        isBatchEditMode
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
      className={`group relative transition-all duration-300 ease-out hover:shadow-xl hover:shadow-blue-200/60 dark:hover:shadow-blue-900/30 hover:-translate-y-0.5 hover:scale-[1.02] flex items-center justify-between rounded-xl border shadow-sm p-3 hover:border-blue-400 dark:hover:border-blue-500 ${
        isSelected
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
      } ${isBatchEditMode ? 'cursor-pointer' : ''}`}
      onClick={() => isBatchEditMode && onToggleSelection(link.id)}
      onContextMenu={(e) => onContextMenu(e, link)}
    >
      {isBatchEditMode ? (
        <div className="flex flex-1 min-w-0 overflow-hidden h-full items-center">
          {content}
        </div>
      ) : (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 min-w-0 overflow-hidden h-full items-center"
        >
          {content}
        </a>
      )}
    </div>
  );
};

export default React.memo(LinkCard);
