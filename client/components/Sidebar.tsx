import { HardDrive, Users, Clock, Star, Trash2, Plus, Cloud } from 'lucide-react';

interface SidebarProps {
  currentFilter: string;
  setFilter: (filter: any) => void;
  onUpload: () => void;
}

export default function Sidebar({ currentFilter, setFilter, onUpload }: SidebarProps) {
  const navItemClass = (id: string) => 
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-l-2 ${
      currentFilter === id 
      ? 'bg-primary/10 text-primary border-primary' 
      : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
    }`;

  return (
    <nav className="flex-none w-64 bg-background-dark border-r border-border-dark flex flex-col py-6 px-3 gap-1 z-10 h-full">
      {/* Upload Button */}
      <div className="mb-6 px-3">
        <button 
          onClick={onUpload}
          className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_-3px_rgba(53,158,255,0.3)]"
        >
          <Plus size={20} />
          <span>New Upload</span>
        </button>
      </div>

      {/* Navigation */}
      <button onClick={() => setFilter('all')} className={navItemClass('all')}>
        <HardDrive size={20} /> <span className="text-sm font-medium">My Drive</span>
      </button>
      
      <button onClick={() => setFilter('shared')} className={navItemClass('shared')}>
        <Users size={20} /> <span className="text-sm font-medium">Shared with me</span>
      </button>
      
      <button onClick={() => setFilter('recent')} className={navItemClass('recent')}>
        <Clock size={20} /> <span className="text-sm font-medium">Recent</span>
      </button>
      
      <button onClick={() => setFilter('starred')} className={navItemClass('starred')}>
        <Star size={20} /> <span className="text-sm font-medium">Starred</span>
      </button>
      
      <button onClick={() => setFilter('trash')} className={navItemClass('trash')}>
        <Trash2 size={20} /> <span className="text-sm font-medium">Trash</span>
      </button>

      {/* Storage Widget */}
      <div className="mt-auto px-3 pb-2">
        <div className="p-4 rounded-xl bg-gradient-to-br from-panel-dark to-black border border-border-dark">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-300">Storage</span>
            <span className="text-xs text-primary">78%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: '78%' }}></div>
          </div>
          <p className="text-xs text-gray-500">120 GB of 150 GB used</p>
        </div>
      </div>
    </nav>
  );
}