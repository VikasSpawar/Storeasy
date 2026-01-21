'use client';

import { useEffect, useState } from 'react';
import { 
  X, User, Trash2, Loader2, ShieldAlert, Check, 
  Copy, Globe, ChevronDown, Clock 
} from 'lucide-react';

interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  resourceName: string;
  resourceType?: 'file' | 'folder'; // Optional type check
  ownerId: string; // Needed for inviting
}

export default function ManageAccessModal({ 
  isOpen, 
  onClose, 
  resourceId, 
  resourceName,
  resourceType = 'file',
  ownerId 
}: ManageAccessModalProps) {
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  // UI State
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) fetchShares();
  }, [isOpen, resourceId]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shares/${resourceId}`);
      const data = await res.json();
      setShares(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    setInviting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          resourceType,
          email: inviteEmail,
          role: inviteRole,
          ownerId
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Success: Refresh list & clear input
      await fetchShares();
      setInviteEmail('');
    } catch (err) {
      alert('Failed to invite user. They might already have access.');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    setShares(shares.filter(s => s.id !== shareId)); // Optimistic delete
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shares/${shareId}`, { method: 'DELETE' });
    } catch (err) {
      fetchShares(); // Revert if failed
    }
  };

  const handleRoleChange = async (shareId: string, newRole: string) => {
    // Optimistic Update
    setShares(shares.map(s => s.id === shareId ? { ...s, role: newRole } : s));

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
    } catch (err) {
      fetchShares(); // Revert
    }
  };

  const copyLink = () => {
    // Generates a link to the current view
    // In a real app, this might be a specific public sharing URL
    const url = `${window.location.origin}?fileId=${resourceId}`; 
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e24] border border-[#2a2a30] w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-[#2a2a30] flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-white leading-none">Share "{resourceName}"</h2>
            <p className="text-sm text-gray-500 mt-1">Manage who can view or edit this {resourceType}.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">
          
          {/* 1. INVITE SECTION */}
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="flex-1 relative">
                <input 
                  type="email" 
                  placeholder="Add people via email..." 
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-[#121216] border border-[#2a2a30] text-white text-sm rounded-lg pl-4 pr-24 py-2.5 focus:border-primary outline-none transition-all"
                  autoFocus
                />
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="absolute right-1 top-1 bottom-1 bg-[#1e1e24] text-xs text-gray-300 border-none rounded px-2 outline-none cursor-pointer hover:bg-[#2a2a30]"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
            </div>
            <button 
              type="submit" 
              disabled={inviting || !inviteEmail}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold px-4 rounded-lg transition-colors"
            >
              {inviting ? 'Sending...' : 'Invite'}
            </button>
          </form>

          {/* 2. ACCESS LIST */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">People with access</h3>
            
            <div className="max-h-[240px] overflow-y-auto pr-2 custom-scrollbar space-y-1">
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>
              ) : shares.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500 border border-dashed border-[#2a2a30] rounded-lg">
                    <User size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">Only you have access</p>
                </div>
              ) : (
                shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between group p-2 rounded-lg hover:bg-[#2a2a30]/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-inner">
                        {share.grantee_email[0]}
                      </div>
                      <div>
                        <p className="text-sm text-gray-200 font-medium leading-none">{share.grantee_email}</p>
                        <div className="flex items-center gap-1 mt-1">
                            <Clock size={10} className="text-gray-500" />
                            <p className="text-[10px] text-gray-500">
                                {new Date(share.created_at).toLocaleDateString()} • {new Date(share.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Custom Dropdown for Role */}
                        <div className="relative group/role">
                            <select 
                                value={share.role}
                                onChange={(e) => handleRoleChange(share.id, e.target.value)}
                                className="appearance-none bg-transparent text-xs text-gray-400 font-medium hover:text-white cursor-pointer py-1 pr-6 pl-2 outline-none text-right"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-0 top-1.5 text-gray-500 pointer-events-none" />
                        </div>

                        <button 
                            onClick={() => handleRevoke(share.id)}
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Revoke Access"
                        >
                            <X size={14} />
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-[#121216] border-t border-[#2a2a30] flex items-center justify-between">
            <button 
                onClick={copyLink}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Link Copied!' : 'Copy Link'}
            </button>
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <Globe size={12} />
                <span>Restricted Access</span>
            </div>
        </div>

      </div>
    </div>
  );
}