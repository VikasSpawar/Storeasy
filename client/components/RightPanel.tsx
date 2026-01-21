import { X, Eye, Share2, Download, FileText, Image as ImageIcon, Folder } from 'lucide-react';

interface RightPanelProps {
  file: any; // The selected file
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onOpen: () => void; // Double click action
}

export default function RightPanel({ file, onClose, onDownload, onShare, onOpen }: RightPanelProps) {
  if (!file) return null;

  const isFolder = !file.mime_type; // Simple check

  return (
    <aside className="w-80 bg-background-dark border-l border-border-dark flex flex-col overflow-y-auto z-10 shadow-xl h-full transition-all">
      {/* Header */}
      <div className="px-5 py-6 border-b border-border-dark">
        <div className="flex justify-between items-start mb-4">
          <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
            {isFolder ? <Folder size={24} /> : <FileText size={24} />}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <h3 className="text-lg font-bold text-white leading-tight mb-1 break-words">{file.name}</h3>
        <p className="text-sm text-gray-500">{isFolder ? 'Folder' : file.mime_type}</p>
      </div>

      {/* Preview Card */}
      <div className="p-5">
        <div className="aspect-video w-full rounded-lg bg-[#25252b] border border-border-dark flex items-center justify-center relative overflow-hidden group">
          {file.mime_type?.startsWith('image/') && file.publicUrl ? (
             <img src={file.publicUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
          ) : (
             <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black"></div>
          )}
          <Eye className="text-white/50 z-10" size={32} />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onOpen} className="flex-1 bg-primary text-black text-sm font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors">Open</button>
          <button onClick={onShare} className="flex-1 bg-panel-dark border border-border-dark text-white text-sm font-medium py-2 rounded-lg hover:bg-white/5 transition-colors">Share</button>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 border-t border-border-dark space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Details</h4>
        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div className="text-gray-500">Size</div>
          <div className="text-white font-mono text-right">{file.size_bytes ? (file.size_bytes / 1024 / 1024).toFixed(2) + ' MB' : '--'}</div>
          
          <div className="text-gray-500">Created</div>
          <div className="text-white text-right">{new Date(file.created_at).toLocaleDateString()}</div>
        </div>
      </div>
    </aside>
  );
}