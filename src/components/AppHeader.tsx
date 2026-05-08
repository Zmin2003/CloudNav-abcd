import React from 'react';
import { Settings, Plus, Upload, FolderInput, CheckSquare, Bot, Loader2, Menu, X } from 'lucide-react';

interface AppHeaderProps {
  navigationName?: string;
  syncStatus: string;
  isBatchEditMode: boolean;
  isAiSorting: boolean;
  isMobileMenuOpen: boolean;
  onOpenSettings: () => void;
  onAddLink: () => void;
  onImport: () => void;
  onBackup: () => void;
  onManageCategories: () => void;
  onToggleBatchEdit: () => void;
  onAiSort: () => void;
  onToggleMobileMenu: () => void;
}

const statusClass = (syncStatus: string) => {
  if (syncStatus === 'saving') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (syncStatus === 'saved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (syncStatus === 'error') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400';
};

const statusText = (syncStatus: string) => {
  if (syncStatus === 'saving') return '同步中';
  if (syncStatus === 'saved') return '已同步';
  if (syncStatus === 'error') return '同步失败';
  return '本地模式';
};

const menuButtonClass = 'flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg active:scale-95 transition-all';

const AppHeader: React.FC<AppHeaderProps> = ({
  navigationName, syncStatus, isBatchEditMode, isAiSorting, isMobileMenuOpen,
  onOpenSettings, onAddLink, onImport, onBackup, onManageCategories, onToggleBatchEdit, onAiSort, onToggleMobileMenu,
}) => {
  return (
    <>
      <header className="glass-header header-glow h-14 sm:h-16 px-3 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-10 shrink-0 safe-area-top safe-area-x" style={{ transform: 'translateZ(0)' }}>
        <div className="flex items-center gap-4 sm:gap-6">
          <span className="brand-glow app-brand-text text-lg sm:text-xl font-bold">{navigationName || 'Zmin Nav'}</span>
          <span className={`hidden md:inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${statusClass(syncStatus)}`}>
            {statusText(syncStatus)}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button onClick={onOpenSettings} className="btn-pop p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all hover:scale-110 active:scale-95" title="设置"><Settings size={20} /></button>
          <button onClick={onAddLink} className="btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-full transition-all shadow-sm"><Plus size={14} /> 添加</button>
          <button onClick={onImport} className="btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-600 transition-all hover:shadow-sm"><Upload size={14} /> 导入</button>
          <button onClick={onBackup} className="btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-600 transition-all hover:shadow-sm"><Upload size={14} /> 备份</button>
          <button onClick={onManageCategories} className="btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-600 transition-all hover:shadow-sm"><Settings size={14} /> 分类</button>
          <button onClick={onToggleBatchEdit} className={`btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-all hover:shadow-sm ${isBatchEditMode ? 'bg-[#D2E3FC] dark:bg-[#4285F4]/25 text-[#1A73E8] dark:text-[#8AB4F8] border-[#AECBFA] dark:border-[#4285F4]/40' : 'text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 border-slate-300 dark:border-slate-600'}`}>
            <CheckSquare size={14} /> 批量
          </button>
          <button onClick={onAiSort} disabled={isAiSorting} className="btn-pop flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#7c3aed] hover:bg-[#6d28d9] rounded-full transition-all disabled:opacity-60 shadow-sm" title="AI 智能整理书签">
            {isAiSorting ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} AI 整理
          </button>
        </div>

        <div className="flex sm:hidden items-center gap-1">
          <button onClick={onToggleMobileMenu} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="sm:hidden glass-panel border-b border-white/20 px-3 py-2 flex flex-wrap gap-2 safe-area-x slide-down">
          <button onClick={onOpenSettings} className={menuButtonClass}><Settings size={16} /> 设置</button>
          <button onClick={onImport} className={menuButtonClass}><Upload size={16} /> 导入</button>
          <button onClick={onManageCategories} className={menuButtonClass}><FolderInput size={16} /> 分类</button>
          <button onClick={onBackup} className={menuButtonClass}><Upload size={16} /> 备份</button>
          <button onClick={onToggleBatchEdit} className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all active:scale-95 ${isBatchEditMode ? 'bg-[#D2E3FC] dark:bg-[#4285F4]/25 text-[#1A73E8] dark:text-[#8AB4F8]' : 'text-slate-700 dark:text-slate-200 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm'}`}><CheckSquare size={16} /> 批量编辑</button>
          <button onClick={onAiSort} disabled={isAiSorting} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-[#7c3aed] rounded-lg active:scale-95 transition-all disabled:opacity-60 shadow-sm">
            {isAiSorting ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} AI 整理
          </button>
        </div>
      )}
    </>
  );
};

export default React.memo(AppHeader);
