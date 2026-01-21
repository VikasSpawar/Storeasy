'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js'; // 1. Import Supabase
import { X, Edit2 } from 'lucide-react';

// Initialize Supabase client to get current user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any; 
  onRenameComplete: () => void;
}

export default function RenameModal({ isOpen, onClose, item, onRenameComplete }: RenameModalProps) {
  const [newName, setNewName] = useState(item?.name || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !item) return null;

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 2. Get the ACTUAL logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const isFolder = !item.mime_type;
      const endpoint = isFolder ? '/api/folders/rename' : '/api/files/rename';
      
      // 3. Send YOUR userId and email, NOT item.owner_id
      const body = { 
        [isFolder ? 'folderId' : 'fileId']: item.id, 
        userId: user.id,   // <--- FIX: This is "You", not the "Owner"
        email: user.email, // <--- FIX: Required for Editor check
        newName 
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // 4. Handle Permission Errors
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to rename');
      }

      onRenameComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message); // Alert the user if they get "Access Denied"
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
      <div className="bg-[#1e1e24] border border-[#2a2a30] w-full max-w-sm rounded-xl shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white mb-4">Rename Item</h2>
        <form onSubmit={handleRename}>
          <input 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-[#121216] border border-[#2a2a30] text-white p-3 rounded-lg focus:border-primary outline-none mb-4"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button disabled={loading} className="px-4 py-2 bg-primary text-black font-bold rounded-lg text-sm">
              {loading ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}