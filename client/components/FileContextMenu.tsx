'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  Download, Share2, Edit2, Copy, Trash2, FolderInput, Eye, Star, RotateCcw, XCircle 
} from 'lucide-react';
import { Permission } from '@/types/dashboard.types';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number, y: number };
  item: any;
  isTrash?: boolean; // <--- NEW PROP
  actions: {
    onOpen: () => void;
    onDownload: () => void;
    onShare: () => void;
    onRename: () => void;
    onMove: () => void;
    onCopy: () => void;
    onDelete: () => void;
    onToggleStar: () => void;
    onRestore: () => void; 
  };
  permission: Permission | string;
}

export default function FileContextMenu({ isOpen, onClose, position, item, isTrash, actions, permission }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const handleScroll = () => onClose();

    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        let { x, y } = position;
        if (y + rect.height > window.innerHeight) y -= rect.height; 
        x -= rect.width; 
        setAdjustedPosition({ x, y });
    }
  }, [isOpen, position]);

  if (!isOpen || !item) return null;

  // --- TRASH MENU (Simplified) ---
  if (isTrash) {
    return (
        <div 
          ref={menuRef}
          style={{ top: adjustedPosition.y, left: adjustedPosition.x }} 
          className="fixed z-[9999] w-56 bg-[#1e1e24] border border-[#2a2a30] rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-75"
        >
            <button onClick={actions.onRestore} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-green-400 hover:bg-[#2a2a30] hover:text-green-300 text-left transition-colors">
              <RotateCcw size={16} /> Restore
            </button>

            <div className="h-[1px] bg-[#2a2a30] my-1 mx-2"></div>

            <button onClick={actions.onDelete} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 text-left transition-colors">
              <XCircle size={16} /> Delete Forever
            </button>
        </div>
    );
  }

  // --- STANDARD MENU ---
  return (
    <div 
      ref={menuRef}
      style={{ top: adjustedPosition.y, left: adjustedPosition.x }} 
      className="fixed z-[9999] w-56 bg-[#1e1e24] border border-[#2a2a30] rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-75"
    >
      {/* OPEN (Everyone) */}
        <button onClick={actions.onOpen} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
          <Eye size={16} /> Open
        </button>
        
        {/* DOWNLOAD (Everyone) */}
        {item.mime_type && (
          <button onClick={actions.onDownload} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
            <Download size={16} /> Download
          </button>
        )}
        
        {/* SHARE (Owner/Editor only) */}
        {(permission === 'owner' || permission === 'editor') && (
            <button onClick={actions.onShare} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
            <Share2 size={16} /> Share
            </button>
        )}

        <div className="h-[1px] bg-[#2a2a30] my-1 mx-2"></div>

        {/* RENAME (Owner/Editor only) */}
        {(permission === 'owner' || permission === 'editor') && (
            <button onClick={actions.onRename} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
            <Edit2 size={16} /> Rename
            </button>
        )}

        {/* MOVE (Owner/Editor only) */}
        {(permission === 'owner' || permission === 'editor') && (
            <button onClick={actions.onMove} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
            <FolderInput size={16} /> Move to...
            </button>
        )}

        {/* COPY (Owner/Editor only) */}
        {item.mime_type && (permission === 'owner' || permission === 'editor') && (
          <button onClick={actions.onCopy} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white text-left transition-colors">
            <Copy size={16} /> Make a Copy
          </button>
        )}

        <div className="h-[1px] bg-[#2a2a30] my-1 mx-2"></div>

        {/* DELETE (Owner/Editor only) */}
        {(permission === 'owner' || permission === 'editor') && (
            <button onClick={actions.onDelete} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 text-left transition-colors">
            <Trash2 size={16} /> Delete
            </button>
        )}
    </div>
  );
}