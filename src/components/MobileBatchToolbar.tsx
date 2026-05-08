import React from 'react';
import { Trash2 } from 'lucide-react';

interface MobileBatchToolbarProps {
  visible: boolean;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onDelete: () => void;
  onDone: () => void;
}

const MobileBatchToolbar: React.FC<MobileBatchToolbarProps> = ({
  visible, selectedCount, allSelected, onSelectAll, onDelete, onDone,
}) => {
  if (!visible) return null;

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3 safe-area-bottom safe-area-x slide-up-sheet">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          已选 <b className="text-[#1A73E8] dark:text-[#8AB4F8]">{selectedCount}</b> 项
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
            {allSelected ? '取消全选' : '全选'}
          </button>
          <button
            onClick={onDelete}
            disabled={selectedCount === 0}
            className="px-3 py-1.5 text-xs font-medium bg-[#FCE8E6] dark:bg-[#EA4335]/20 text-[#EA4335] dark:text-[#F28B82] rounded-lg disabled:opacity-40"
          >
            <Trash2 size={14} className="inline mr-1" />删除
          </button>
          <button onClick={onDone} className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg">
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(MobileBatchToolbar);
