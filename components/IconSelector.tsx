import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { X, Search } from 'lucide-react';
import Icon from './Icon';

interface IconSelectorProps {
  onSelectIcon: (iconName: string) => void;
}

// 常用图标列表，可以根据需要扩展
const commonIcons = [
  'Star', 'Heart', 'Bookmark', 'Flag', 'Tag', 'Hash',
  'Home', 'User', 'Users', 'Settings', 'Bell', 'Mail',
  'Calendar', 'Clock', 'MapPin', 'Phone', 'Camera', 'Image',
  'Folder', 'File', 'Archive', 'Trash2', 'Download', 'Upload',
  'Search', 'Filter', 'Menu', 'MoreVertical', 'ChevronDown', 'ChevronUp',
  'Plus', 'Minus', 'X', 'Check', 'AlertCircle', 'Info',
  'Edit', 'Copy', 'Share', 'Link', 'ExternalLink', 'Lock',
  'Code', 'Terminal', 'Database', 'Server', 'Cloud', 'Wifi',
  'ShoppingCart', 'CreditCard', 'Package', 'Truck', 'Store', 'Tag',
  'Music', 'Play', 'Pause', 'Volume2', 'Headphones', 'Mic',
  'Book', 'BookOpen', 'FileText', 'PenTool', 'Highlighter', 'Type',
  'Layout', 'Grid', 'List', 'Columns', 'Sidebar', 'Layers',
  'Circle', 'Square', 'Triangle', 'Hexagon', 'Zap', 'Target',
  'Rocket', 'Plane', 'Car', 'Bike', 'Ship', 'Train',
  'Moon', 'Sun', 'CloudRain', 'CloudSnow', 'Wind', 'Thermometer',
  'Github', 'Gitlab', 'Chrome', 'Firefox', 'Safari', 'Edge',
  'MessageSquare', 'MessageCircle', 'Send', 'AtSign', 'Percent'
];

const IconSelector: React.FC<IconSelectorProps> = ({ 
  onSelectIcon
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Folder');

  // 获取当前目标图标
  const getCurrentIcon = () => {
    return selectedIcon;
  };

  // 过滤图标
  const filteredIcons = commonIcons.filter(icon => 
    icon.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (iconName: string) => {
    setSelectedIcon(iconName);
  };

  const handleConfirm = () => {
    onSelectIcon(selectedIcon);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索图标..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
          />
        </div>
      </div>

      {/* Current Selection */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">当前选择:</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <Icon name={selectedIcon} size={18} />
            <span className="text-sm font-medium dark:text-slate-200">{selectedIcon}</span>
          </div>
        </div>
      </div>

      {/* Icons Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredIcons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Search size={40} className="mb-3 opacity-50" />
            <p>没有找到匹配的图标</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {filteredIcons.map(iconName => (
              <button
                key={iconName}
                onClick={() => handleSelect(iconName)}
                className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedIcon === iconName 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title={iconName}
              >
                <Icon name={iconName} size={20} />
                <span className="text-xs truncate w-full text-center">{iconName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            提示：也可以直接输入 emoji 作为图标
          </span>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            确定选择
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconSelector;