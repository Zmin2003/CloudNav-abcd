import React, { useEffect, useRef, useState } from 'react';
import { Copy, QrCode, Edit2, Trash2, Pin, X } from 'lucide-react';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopyLink: () => void;
  onShowQRCode: () => void;
  onEditLink: () => void;
  onDeleteLink: () => void;
  onTogglePin: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onCopyLink,
  onShowQRCode,
  onEditLink,
  onDeleteLink,
  onTogglePin
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { icon: Copy, label: '复制链接', onClick: onCopyLink },
    { icon: QrCode, label: '显示二维码', onClick: onShowQRCode },
    { icon: Edit2, label: '编辑链接', onClick: onEditLink },
    { icon: Pin, label: '置顶/取消置顶', onClick: onTogglePin },
    { icon: Trash2, label: '删除链接', onClick: onDeleteLink, className: 'text-red-600 dark:text-red-400' }
  ];

  const handleItemClick = (e: React.MouseEvent | React.TouchEvent, onClick: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    onClose();
  };

  // Mobile: bottom action sheet
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm fade-in" onClick={onClose}>
        <div
          ref={menuRef}
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl safe-area-bottom slide-up-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          <div className="px-2 pb-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={(e) => handleItemClick(e, item.onClick)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 text-base rounded-xl active:bg-slate-100 dark:active:bg-slate-700 transition-colors ${
                  item.className || 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <item.icon size={20} className={item.className} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Cancel button */}
          <div className="px-4 pb-4">
            <button
              onClick={onClose}
              className="w-full py-3 text-center text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 rounded-xl active:bg-slate-200 dark:active:bg-slate-600"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: positioned dropdown
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 250)
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => handleItemClick(e, item.onClick)}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
            item.className || 'text-slate-700 dark:text-slate-300'
          }`}
        >
          <item.icon size={16} className={item.className} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;