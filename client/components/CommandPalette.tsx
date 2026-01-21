'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk'; 
import { Search, File as FileIcon, Image as ImageIcon, Folder, Loader2 } from 'lucide-react';

interface PaletteProps {
  userId: string;
  onSelectFile: (file: any) => void;
  onSelectFolder: (folderId: string) => void;
}

export default function CommandPalette({ userId, onSelectFile, onSelectFolder }: PaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ files: any[], folders: any[] }>({ files: [], folders: [] });

  // Toggle with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced Search (Wait 300ms after typing stops)
  useEffect(() => {
    if (query.length < 2) {
      setResults({ files: [], folders: [] });
      return;
    }

    const timer = setTimeout(async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/files/search?userId=${userId}&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userId]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-800 px-4">
          <Search className="text-gray-500 mr-3" size={20} />
          <Command.Input 
            placeholder="Search files and folders..." 
            value={query}
            onValueChange={setQuery}
            className="w-full h-14 bg-transparent text-lg text-white placeholder:text-gray-500 outline-none"
          />
          {loading && <Loader2 className="animate-spin text-blue-500 mr-2" size={16} />}
          <div className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-1">ESC</div>
        </div>

        {/* Results List */}
        <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
          {!loading && results.files.length === 0 && results.folders.length === 0 && query.length > 1 && (
            <Command.Empty className="py-6 text-center text-gray-500 text-sm">
              No results found.
            </Command.Empty>
          )}

          {/* FOLDERS SECTION */}
          {results.folders.length > 0 && (
            <Command.Group heading="Folders" className="text-xs font-medium text-gray-500 px-2 py-2">
              {results.folders.map((folder) => (
                <Command.Item
                  key={folder.id}
                  value={`folder-${folder.name}`} // Value helps cmdk filter, but we fetch from API so it's less critical
                  onSelect={() => {
                    onSelectFolder(folder.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-200 text-sm cursor-pointer hover:bg-gray-800 aria-selected:bg-gray-800"
                >
                  <Folder size={16} className="text-yellow-500" />
                  <span>{folder.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* FILES SECTION */}
          {results.files.length > 0 && (
            <Command.Group heading="Files" className="text-xs font-medium text-gray-500 px-2 py-2">
              {results.files.map((file) => (
                <Command.Item
                  key={file.id}
                  value={`file-${file.name}`}
                  onSelect={() => {
                    onSelectFile(file);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-200 text-sm cursor-pointer hover:bg-gray-800 aria-selected:bg-gray-800"
                >
                  {file.mime_type?.startsWith('image/') ? (
                    <ImageIcon size={16} className="text-blue-500" />
                  ) : (
                    <FileIcon size={16} className="text-gray-500" />
                  )}
                  <span>{file.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}