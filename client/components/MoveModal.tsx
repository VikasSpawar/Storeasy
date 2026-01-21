'use client';

import { useEffect, useState } from 'react';
import { X, Folder, Check, Home } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (for fetching folders)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: any;
  userId: string;
  onMoveComplete: () => void;
}

export default function MoveModal({ isOpen, onClose, file, userId, onMoveComplete }: MoveModalProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  // Fetch all folders when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      supabase
        .from('folders')
        .select('id, name')
        .eq('owner_id', userId)
        .order('name')
        .then(({ data }) => {
          setFolders(data || []);
          setLoading(false);
        });
    }
  }, [isOpen, userId]);

  const handleMove = async (targetFolderId: string | null) => {
    setMoving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/files/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fileId: file.id,
          destinationFolderId: targetFolderId
        })
      });
      onMoveComplete();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to move file');
    } finally {
      setMoving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold mb-4 text-white">Move "{file.name}" to...</h2>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Option: Root */}
          <button
            onClick={() => handleMove(null)}
            disabled={moving}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors text-left"
          >
            <Home size={18} className="text-blue-500" />
            <span>Root Directory</span>
            {file.folder_id === null && <Check size={16} className="ml-auto text-green-500" />}
          </button>

          {/* Option: Folders */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleMove(folder.id)}
              disabled={moving || file.folder_id === folder.id}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                file.folder_id === folder.id ? 'bg-gray-800/50 opacity-50 cursor-default' : 'hover:bg-gray-800 text-gray-300'
              }`}
            >
              <Folder size={18} className="text-yellow-500" />
              <span className="truncate">{folder.name}</span>
              {file.folder_id === folder.id && <Check size={16} className="ml-auto text-green-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}