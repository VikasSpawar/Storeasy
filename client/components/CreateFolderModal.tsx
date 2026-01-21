'use client';

import { useState } from 'react';
import { X, FolderPlus, Loader2 } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  userId: string;
  onFolderCreated: () => void; // Trigger refresh
}

export default function CreateFolderModal({ 
  isOpen, 
  onClose, 
  parentId, 
  userId, 
  onFolderCreated 
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentId, // Creates inside current folder
          userId
        })
      });

      if (!res.ok) throw new Error('Failed to create folder');
      
      onFolderCreated();
      setName(''); // Reset form
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error creating folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <FolderPlus className="text-blue-500" />
          New Folder
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Folder Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none mb-4"
            autoFocus
          />

          <button 
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}