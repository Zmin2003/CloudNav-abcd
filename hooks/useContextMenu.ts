import { useState, useCallback, MouseEvent } from 'react';
import { LinkItem } from '../types';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  link: LinkItem | null;
}

interface QrCodeModalState {
  isOpen: boolean;
  url: string;
  title: string;
}

interface UseContextMenuReturn {
  contextMenu: ContextMenuState;
  qrCodeModal: QrCodeModalState;
  handleContextMenu: (event: MouseEvent, link: LinkItem, isBatchEditMode: boolean) => void;
  closeContextMenu: () => void;
  copyLinkToClipboard: () => void;
  showQRCode: () => void;
  editLinkFromContextMenu: (onEdit: (link: LinkItem) => void) => void;
  deleteLinkFromContextMenu: (onDelete: (link: LinkItem) => void) => void;
  togglePinFromContextMenu: (links: LinkItem[], onUpdate: (updated: LinkItem[]) => void) => void;
  closeQrCodeModal: () => void;
}

const INITIAL_CONTEXT_MENU: ContextMenuState = {
  isOpen: false,
  position: { x: 0, y: 0 },
  link: null,
};

const INITIAL_QR_MODAL: QrCodeModalState = {
  isOpen: false,
  url: '',
  title: '',
};

export function useContextMenu(): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(INITIAL_CONTEXT_MENU);
  const [qrCodeModal, setQrCodeModal] = useState<QrCodeModalState>(INITIAL_QR_MODAL);

  const closeContextMenu = useCallback(() => {
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, []);

  const handleContextMenu = useCallback((
    event: MouseEvent,
    link: LinkItem,
    isBatchEditMode: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (isBatchEditMode) return;
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      link,
    });
  }, []);

  const copyLinkToClipboard = useCallback(() => {
    if (!contextMenu.link) return;
    const url = contextMenu.link.url;
    
    // 安全校验：只复制 HTTP/HTTPS 链接
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn('拒绝复制非 HTTP(S) 链接');
        setContextMenu(INITIAL_CONTEXT_MENU);
        return;
      }
    } catch {
      console.warn('链接格式无效');
      setContextMenu(INITIAL_CONTEXT_MENU);
      return;
    }

    navigator.clipboard.writeText(url)
      .catch(err => console.error('复制链接失败:', err));
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, [contextMenu.link]);

  const showQRCode = useCallback(() => {
    if (!contextMenu.link) return;
    setQrCodeModal({
      isOpen: true,
      url: contextMenu.link.url,
      title: contextMenu.link.title,
    });
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, [contextMenu.link]);

  const editLinkFromContextMenu = useCallback((onEdit: (link: LinkItem) => void) => {
    if (!contextMenu.link) return;
    onEdit(contextMenu.link);
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, [contextMenu.link]);

  const deleteLinkFromContextMenu = useCallback((onDelete: (link: LinkItem) => void) => {
    if (!contextMenu.link) return;
    if (window.confirm(`确定要删除"${contextMenu.link.title}"吗？`)) {
      onDelete(contextMenu.link);
    }
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, [contextMenu.link]);

  const togglePinFromContextMenu = useCallback((
    links: LinkItem[],
    onUpdate: (updated: LinkItem[]) => void,
  ) => {
    if (!contextMenu.link) return;
    const targetId = contextMenu.link.id;
    const updated = links.map(l => {
      if (l.id === targetId) {
        const isPinned = !l.pinned;
        return {
          ...l,
          pinned: isPinned,
          pinnedOrder: isPinned ? links.filter(link => link.pinned).length : undefined,
        };
      }
      return l;
    });
    onUpdate(updated);
    setContextMenu(INITIAL_CONTEXT_MENU);
  }, [contextMenu.link]);

  const closeQrCodeModal = useCallback(() => {
    setQrCodeModal(INITIAL_QR_MODAL);
  }, []);

  return {
    contextMenu,
    qrCodeModal,
    handleContextMenu,
    closeContextMenu,
    copyLinkToClipboard,
    showQRCode,
    editLinkFromContextMenu,
    deleteLinkFromContextMenu,
    togglePinFromContextMenu,
    closeQrCodeModal,
  };
}
