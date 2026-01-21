
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Filter,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Folder,
  File as FileIcon,
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  FolderPlus,
  Star,
  UserIcon,
  Settings,
  LogOut,
} from "lucide-react";

// Components
import Sidebar from "../components/Sidebar";
import RightPanel from "../components/RightPanel";
import UploadModal from "../components/UploadModal";
import CreateFolderModal from "../components/CreateFolderModal";
import CommandPalette from "../components/CommandPalette";
import ManageAccessModal from "../components/ManageAccessModal";
import RenameModal from "../components/RenameModal";
import FileContextMenu from "../components/FileContextMenu";
import MoveModal from "../components/MoveModal";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function Dashboard() {
  // --- STATE ---
  const [user, setUser] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation & View
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "shared" | "starred" | "trash" | "recent"
  >("all");
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Selection
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // Context Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); // Optional if doing fixed positioning
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<any>(null);
  // ... inside Dashboard component
  const [fileToMove, setFileToMove] = useState<any>(null); 

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const router = useRouter();

  // --- 1. AUTH & INIT ---
  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.push("/login");
      else {
        setUser(user);
        // Initial fetch handled by the next useEffect dependent on user/filter/folder
      }
    }
    getUser();
  }, [router]);

  // --- 2. DATA FETCHING ---
  useEffect(() => {
    if (user) {
      fetchContent(user.id, currentFolder, filter);
    }
  }, [user, currentFolder, filter]);

async function fetchContent(
    userId: string,
    folderId: string | null,
    currentFilter: string,
  ) {
    setLoading(true);
    setSelectedItem(null);
    setFiles([]);
    setFolders([]);

    try {
      // --- SCENARIO A: SHARED WITH ME ---
      if (currentFilter === "shared") {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/shared-with-me?email=${user.email}`,
        );
        const data = await res.json();

        // FIX: Do NOT sign on frontend. Backend sends 'publicUrl'.
        setFiles(data.files || []); 
        setFolders(data.folders || []);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // --- SCENARIO B: TRASH (Client-side fetch is okay if "My Trash") ---
      if (currentFilter === "trash") {
        const { data: trashFiles } = await supabase
          .from("files")
          .select("*")
          .eq("owner_id", userId)
          .eq("is_deleted", true)
          .order("updated_at", { ascending: false });

        const { data: trashFolders } = await supabase
          .from("folders")
          .select("*")
          .eq("owner_id", userId)
          .eq("is_deleted", true);

        // NOTE: We can keep signUrls here ONLY because I own my trash.
        // Ideally, move this to backend too for consistency.
        setFiles(await signUrls(trashFiles || []));
        setFolders(trashFolders || []);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // --- SCENARIO C: RECENT ---
      if (currentFilter === "recent") {
        const { data: recentFiles } = await supabase
          .from("files")
          .select("*")
          .eq("owner_id", userId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(20);

        setFiles(await signUrls(recentFiles || [])); // I own these, so I can sign them.
        setFolders([]);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // --- SCENARIO D: STANDARD (MY DRIVE / STARRED) ---
      // 1. Fetch Folders
      let folderQuery = supabase
        .from("folders")
        .select("*")
        .eq("owner_id", userId)
        .eq("is_deleted", false)
        .order("name");

      if (folderId) folderQuery = folderQuery.eq("parent_id", folderId);
      else folderQuery = folderQuery.is("parent_id", null);

      if (currentFilter === "starred") {
        setFolders([]); 
      } else {
        const { data: dbFolders } = await folderQuery;
        setFolders(dbFolders || []);
      }

      // 2. Fetch Files via API (Backend handles signing!)
      const params = new URLSearchParams({
        userId: userId,
        folderId: folderId || "",
        email: user.email || "",
      });

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/files?${params}`,
      );
      let fetchedFiles = await res.json();

      if (currentFilter === "starred") {
        fetchedFiles = fetchedFiles.filter((f: any) => f.is_starred);
      }

      setFiles(fetchedFiles || []); // Backend already signed these!

      // 3. Breadcrumbs
      if (folderId) {
        const { data } = await supabase.rpc("get_folder_path", {
          target_folder_id: folderId,
        });
        setBreadcrumbs(data || []);
      } else {
        setBreadcrumbs([]);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }

  // Helper to generate Signed URLs
  async function signUrls(fileList: any[]) {
    return Promise.all(
      fileList.map(async (file) => {
        if (
          file.mime_type?.startsWith("image/") ||
          file.mime_type === "application/pdf"
        ) {
          const { data } = await supabase.storage
            .from("user-data")
            .createSignedUrl(file.storage_key, 3600);
          return { ...file, publicUrl: data?.signedUrl };
        }
        return file;
      }),
    );
  }

  // --- 3. ACTIONS ---

  const handleDoubleClick = (item: any) => {
    if (!item.mime_type) {
      // It's a folder -> Enter it
      setCurrentFolder(item.id);
      setFilter("all"); // Reset filter to explore folder
    } else {
      // It's a file -> Open/Download
      if (item.publicUrl) window.open(item.publicUrl, "_blank");
      else alert("No preview available for this file type.");
    }
  };

// Accept an optional 'itemOverride' argument
  const handleDelete = async (itemOverride?: any) => {
    // 1. Prioritize the direct argument (from Context Menu), fallback to state (from Toolbar)
    const target = itemOverride || selectedItem;

    if (!target || !user) return;

    // confirm message changes based on context
    const isPermanent = filter === "trash";
    const message = isPermanent
      ? `Permanently delete "${target.name}"? This cannot be undone.`
      : `Move "${target.name}" to trash?`;

    if (!confirm(message)) return;

    try {
      if (isPermanent) {
        // --- HARD DELETE ---
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/files/permanent`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              fileId: target.id, // <--- Use 'target'
              resourceType: target.mime_type ? "file" : "folder", // <--- Use 'target'
            }),
          },
        );
        
      } else {
        // --- SOFT DELETE ---
        const isFile = !!target.mime_type;
        const endpoint = isFile ? '/api/files/delete' : '/api/folders/delete';
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
                 [isFile ? 'fileId' : 'folderId']: target.id, // <--- Use 'target'
                 userId: user.id,
                 email: user.email 
             })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Delete failed');
        }
      }

      // Refresh
      fetchContent(user.id, currentFolder, filter);
      
      // Only clear selection if we deleted the currently selected item
      if (selectedItem?.id === target.id) {
          setSelectedItem(null);
      }
      setActiveMenuId(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.message || "Failed to delete item.");
    }
  };

  const handleEmptyTrash = async () => {
    if (
      !confirm(
        "Are you sure you want to EMPTY the trash? All items will be lost forever.",
      )
    )
      return;

    setLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trash/empty`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      fetchContent(user.id, null, "trash");
    } catch (err) {
      console.error(err);
      alert("Failed to empty trash");
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedItem || !user) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        resourceId: selectedItem.id,
        resourceType: selectedItem.mime_type ? "file" : "folder",
      }),
    });
    fetchContent(user.id, currentFolder, filter);
    setSelectedItem(null);
  };

  const handleDownload = async () => {
    if (selectedItem?.publicUrl) {
      // Trigger download by creating a temp link
      const link = document.createElement("a");
      link.href = selectedItem.publicUrl;
      link.download = selectedItem.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Open Menu Logic (Calculates Screen Position)
  const handleMenuClick = (e: React.MouseEvent, item: any) => {
    e.stopPropagation(); // Stop row selection

    if (activeMenuId === item.id) {
      setActiveMenuId(null);
      return;
    }

    // 1. Get the button's location on the screen
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    // 2. Set position (Align top-right of menu to bottom-right of button)
    // We adjust X slightly (-180) to make the menu open to the LEFT of the cursor
    // so it doesn't go off the right side of the screen.
    setMenuPosition({
      x: rect.right,
      y: rect.bottom,
    });

    setActiveMenuId(item.id);
  };

  // Action: Copy
  const handleCopy = async (item: any) => {
    if (!user) return;

    // Optimistic UI: You could show a loading toast here
    console.log("Copying file:", item.id);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/files/copy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, fileId: item.id }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Copy failed");
      }

      // Refresh list to see the new copy
      await fetchContent(user.id, currentFolder, filter);
      setActiveMenuId(null);
      alert("File copied successfully!");
    } catch (err: any) {
      console.error("Copy Error:", err);
      alert(`Failed to copy: ${err.message}`);
    }
  };

  const handleToggleStar = async (item: any) => {
    if (!user) return;
    // Optimistic Update (Instant UI change)
    const newValue = !item.is_starred;
    setFiles(
      files.map((f) => (f.id === item.id ? { ...f, is_starred: newValue } : f)),
    );

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/files/star`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          fileId: item.id,
          value: newValue,
        }),
      });
      // No need to refetch if optimistic worked, but good for safety
      // fetchContent(user.id, currentFolder, filter);
    } catch (err) {
      console.error(err);
      fetchContent(user.id, currentFolder, filter); // Revert on error
    }
  };

  // Action: Rename Trigger
  const openRename = (item: any) => {
    setItemToRename(item);
    setIsRenameOpen(true);
    setActiveMenuId(null);
  };

const getPermission = (item: any) => {
    if (!user || !item) return 'viewer';
    if (item.owner_id === user.id) return 'owner';
    if (item.role) return item.role; // 'viewer' or 'editor'
    
    // SAFETY FIX: Default to 'viewer' so buttons are HIDDEN by default
    return 'viewer'; 
  };

  const canEdit = (item: any) => {
    const perm = getPermission(item);
    return perm === 'owner' || perm === 'editor';
  };

  const openMove = (item: any) => {
    setFileToMove(item); // Set the specific item from the row
    setIsMoveModalOpen(true); // Open the modal
    setActiveMenuId(null); // Close the dropdown menu
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // --- RENDER ---
  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark text-white font-display overflow-hidden">
      {/* 1. SIDEBAR */}
      <Sidebar
        currentFilter={filter}
        setFilter={(f) => {
          setFilter(f);
          setCurrentFolder(null); // Reset to root of that filter
        }}
        onUpload={() => setIsUploadOpen(true)}
      />

      {/* 2. MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#121216] relative transition-all h-full overflow-hidden">
        {/* HEADER */}
        <header className="flex-none h-16 border-b border-border-dark bg-background-dark px-6 flex items-center justify-between z-20">
          {/* Search */}
          <div className="flex-1 max-w-xl">
            <div
              onClick={() =>
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                )
              }
              className="relative group cursor-pointer"
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-500" />
              </div>
              <div className="block w-full rounded-lg border-0 bg-[#0f0f13] py-2 pl-10 text-gray-400 shadow-inner ring-1 ring-inset ring-border-dark sm:text-sm">
                Search files, folders...
              </div>
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <span className="text-xs text-gray-600 bg-[#16161d] px-1.5 py-0.5 rounded border border-border-dark">
                  ⌘K
                </span>
              </div>
            </div>
          </div>

        {/* User Profile Area */}
          <div className="flex items-center gap-4 ml-4 z-50">
            
            {/* Notification Bell */}
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <Bell size={20} />
              {/* Optional: Notification dot */}
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-[#1e1e24]"></span>
            </button>

            <div className="h-8 w-[1px] bg-border-dark mx-1"></div>

            {/* Profile Dropdown Wrapper */}
            <div className="relative">
              
              {/* Trigger Button */}
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-3 cursor-pointer p-1 pr-2 rounded-lg transition-colors select-none ${isProfileOpen ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="bg-gradient-to-tr from-blue-600 to-purple-600 text-white rounded-full size-8 flex items-center justify-center font-bold shadow-lg shadow-purple-900/20">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-sm font-medium leading-none max-w-[100px] truncate text-gray-200">
                    {user?.email}
                  </span>
                </div>
              </div>

              {/* DROPDOWN MENU */}
              {isProfileOpen && (
                <>
                  {/* Invisible Backdrop to handle "Click Outside" */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)} 
                  />

                  {/* The Menu */}
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#1e1e24] border border-[#2a2a30] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right overflow-hidden">
                    
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-[#2a2a30] mb-1">
                        <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                        <p className="text-xs text-gray-500">Free Plan</p>
                    </div>

                    {/* Menu Items */}
                    <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white transition-colors text-left">
                        <UserIcon size={16} /> Profile
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-[#2a2a30] hover:text-white transition-colors text-left">
                        <Settings size={16} /> Settings
                    </button>

                    <div className="h-[1px] bg-[#2a2a30] my-1 mx-2"></div>

                    {/* Log Out */}
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors text-left"
                    >
                        <LogOut size={16} /> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* TOOLBAR & BREADCRUMBS */}
        <div className="pt-6 px-8 pb-4 flex-none">
          <nav className="flex items-center text-sm text-gray-500 mb-4 h-6">
            {filter === "all" && (
              <>
                <button
                  onClick={() => setCurrentFolder(null)}
                  className={`hover:text-white transition-colors ${!currentFolder ? "text-white font-bold" : ""}`}
                >
                  My Drive
                </button>
                {breadcrumbs.map((crumb) => (
                  <div key={crumb.id} className="flex items-center">
                    <ChevronRight size={16} className="mx-2 text-gray-700" />
                    <button
                      onClick={() => setCurrentFolder(crumb.id)}
                      className="hover:text-white transition-colors text-white"
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </>
            )}
            {filter === "shared" && (
              <span className="text-white font-bold">Shared with Me</span>
            )}
            {filter === "starred" && (
              <span className="text-white font-bold">Starred</span>
            )}
            {filter === "trash" && (
              <span className="text-white font-bold">Trash</span>
            )}
            {filter === "recent" && (
              <span className="text-white font-bold">Recent</span>
            )}
          </nav>

          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {currentFolder
                ? breadcrumbs[breadcrumbs.length - 1]?.name
                : filter === "all"
                  ? "My Drive"
                  : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </h2>
            <div className="flex items-center gap-2">
              {/* Show EMPTY TRASH button only in Trash view */}
              {filter === "trash" ? (
                <button
                  onClick={handleEmptyTrash}
                  className="flex items-center gap-2 text-sm font-medium text-red-400 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded border border-red-900/50 transition-colors"
                >
                  <Trash2 size={16} /> Empty Trash
                </button>
              ) : (
                // Otherwise show "New Folder"
                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-300 bg-panel-dark hover:bg-white/10 px-3 py-1.5 rounded border border-border-dark transition-colors"
                >
                  <Folder size={16} /> New Folder
                </button>
              )}
              <div className="h-4 w-[1px] bg-border-dark mx-1"></div>

              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition-colors ${viewMode === "list" ? "text-white bg-white/10" : "text-gray-400 hover:text-white"}`}
              >
                <LayoutList size={20} />
              </button>

              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition-colors ${viewMode === "grid" ? "text-white bg-white/10" : "text-gray-400 hover:text-white"}`}
              >
                <LayoutGrid size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT LIST */}
        <div className="flex-1 overflow-auto px-8 pb-8 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {viewMode === "list" && (
                <div className="w-full text-left border-separate border-spacing-y-2 pb-20">
                  {/* Header Row */}
                  <div className="flex items-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-border-dark/50 mb-2 sticky top-0 bg-[#121216] z-10">
                    <div className="flex-1 min-w-[300px]">Name</div>
                    <div className="w-40 hidden md:block">Date Modified</div>
                    <div className="w-28 hidden sm:block">Size</div>
                    <div className="w-10"></div>
                  </div>

                  {/* Empty State */}
                  {folders.length === 0 && files.length === 0 && (
                    <div className="text-center py-20 text-gray-500">
                      <Folder size={48} className="mx-auto mb-4 opacity-20" />
                      <p>This folder is empty</p>
                    </div>
                  )}

                  {/* FOLDERS */}
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedItem(folder)}
                      onDoubleClick={() => handleDoubleClick(folder)}
                      className={`group flex items-center px-4 py-3 border rounded-lg transition-all cursor-pointer mb-2 select-none ${
                        selectedItem?.id === folder.id
                          ? "bg-[#1e2329] border-primary/60 shadow-[0_0_0_1px_rgba(53,158,255,0.1)]"
                          : "bg-panel-dark border-border-dark hover:border-primary/50 hover:bg-[#23232a]"
                      }`}
                    >
                      <div className="flex-1 min-w-[300px] flex items-center gap-4">
                        <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                          <Folder size={20} fill="currentColor" />
                        </div>
                        <span
                          className={`text-sm font-medium ${selectedItem?.id === folder.id ? "text-white" : "text-gray-200 group-hover:text-white"}`}
                        >
                          {folder.name}
                        </span>
                      </div>
                      <div className="w-40 text-sm text-gray-400 hidden md:block">
                        {new Date(folder.created_at).toLocaleDateString()}
                      </div>
                     <div className="w-10 flex justify-end relative pointer-events-auto">
                                <button 
                                    onClick={(e) => handleMenuClick(e, folder)}
                                    className="text-gray-400 hover:text-white p-2 rounded hover:bg-[#2a2a30]"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                <FileContextMenu 
                                   permission={getPermission(folder)}
                                    isOpen={activeMenuId === folder.id}
                                    onClose={() => setActiveMenuId(null)}
                                    position={menuPosition}
                                    item={folder}
                                    isTrash={filter === 'trash'} // <--- Pass isTrash
                                    actions={{
                                        // Subset of actions for folders
                                        onOpen: () => handleDoubleClick(folder),
                                        onRename: () => openRename(folder),
                                        onMove: () => openMove(folder), // Folders can be moved too!
                                        onShare: () => { setSelectedItem(folder); setIsAccessModalOpen(true); setActiveMenuId(null); },
                                       onDelete: () => { handleDelete(folder); setActiveMenuId(null); },
                                        onRestore: () => { setSelectedItem(folder); handleRestore(); setActiveMenuId(null); },
                                        
                                        // Empty handlers for file-only actions
                                        onDownload: () => {},
                                        onCopy: () => {},
                                        onToggleStar: () => {},
                      
                                    }}
                                />
                            </div>
                    </div>
                  ))}

                  {/* FILES */}
                  {files.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedItem(file)}
                      onDoubleClick={() => handleDoubleClick(file)}
                      className={`group flex items-center px-4 py-3 border rounded-lg transition-all cursor-pointer mb-2 select-none ${
                        selectedItem?.id === file.id
                          ? "bg-[#1e2329] border-primary/60 shadow-[0_0_0_1px_rgba(53,158,255,0.1)]"
                          : "bg-panel-dark border-border-dark hover:border-primary/50 hover:bg-[#23232a]"
                      }`}
                    >
                      <div className="flex-1 min-w-[300px] flex items-center gap-4">
                        <div
                          className={`size-10 rounded-lg flex items-center justify-center ${
                            file.mime_type.includes("image")
                              ? "bg-purple-500/10 text-purple-400"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {file.mime_type.includes("image") ? (
                            <ImageIcon size={20} />
                          ) : (
                            <FileIcon size={20} />
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium ${selectedItem?.id === file.id ? "text-white" : "text-gray-200 group-hover:text-white"}`}
                        >
                          {file.name}
                        </span>
                      </div>
                      <div className="w-40 text-sm text-gray-400 hidden md:block">
                        {new Date(file.created_at).toLocaleDateString()}
                      </div>
                      <div className="w-28 text-sm text-gray-400 font-mono hidden sm:block">
                        {(file.size_bytes / 1024 / 1024).toFixed(1)} MB
                      </div>
                      <div className="w-10 flex justify-end relative">
                        <button
                          onClick={(e) => handleMenuClick(e, file)}
                          className="text-gray-400 hover:text-white p-2 rounded hover:bg-[#2a2a30]"
                        >
                          <MoreVertical size={16} />
                        </button>

                        <FileContextMenu
                          permission={getPermission(file)}
                          isOpen={activeMenuId === file.id}
                          onClose={() => setActiveMenuId(null)}
                          position={menuPosition}
                          item={file}
                          isTrash={filter === "trash"} // <--- Pass the check
                          actions={{
                            onOpen: () => handleDoubleClick(file),
                            onDownload: () => {
                              handleDownload();
                              setActiveMenuId(null);
                            },
                            onShare: () => {
                              setSelectedItem(file);
                              setIsAccessModalOpen(true);
                              setActiveMenuId(null);
                            },
                            onRename: () => openRename(file),
                            onMove: () => openMove(file),
                            onCopy: () => handleCopy(file),
                            onToggleStar: () => {
                              handleToggleStar(file);
                              setActiveMenuId(null);
                            },
                           onDelete: () => { handleDelete(file); setActiveMenuId(null); },

                            // Restore Action (Reuse the handleRestore logic)
                            onRestore: () => {
                              setSelectedItem(file); // Ensure item is selected
                              handleRestore();
                              setActiveMenuId(null);
                            },
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- GRID VIEW (Cards) --- */}
              {viewMode === "grid" && (
                <div className="pb-20">
                  {/* Folders Grid */}
                  {folders.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                        Folders
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            onClick={() => setSelectedItem(folder)}
                            onDoubleClick={() => handleDoubleClick(folder)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 group
                                                    ${
                                                      selectedItem?.id ===
                                                      folder.id
                                                        ? "bg-[#1e2329] border-primary/60 shadow-[0_0_0_1px_rgba(53,158,255,0.1)]"
                                                        : "bg-panel-dark border-border-dark hover:bg-[#23232a]"
                                                    }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                <Folder size={20} fill="currentColor" />
                              </div>
                              <button
                                onClick={(e) => handleMenuClick(e, folder)}
                                className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                            <span className="text-sm font-medium text-gray-200 truncate">
                              {folder.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files Grid */}
                  {files.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                        Files
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            // 1. REMOVE 'overflow-hidden' from here so menu can pop out
                            className={`group relative rounded-xl border transition-all cursor-pointer flex flex-col
                                                    ${
                                                      selectedItem?.id ===
                                                      file.id
                                                        ? "bg-[#1e2329] border-primary/60 ring-1 ring-primary/20"
                                                        : "bg-panel-dark border-border-dark hover:bg-[#23232a]"
                                                    }`}
                          >
                            {/* 2. CLICK HANDLER (On wrapper to capture clicks properly) */}
                            <div
                              className="absolute inset-0 z-0"
                              onClick={() => setSelectedItem(file)}
                              onDoubleClick={() => handleDoubleClick(file)}
                            />

                            {/* 3. PREVIEW IMAGE (Apply rounding & overflow here instead) */}
                            <div className="h-32 w-full bg-black/20 border-b border-border-dark/50 relative rounded-t-xl overflow-hidden">
                              {file.mime_type.includes("image") &&
                              file.publicUrl ? (
                                <img
                                  src={file.publicUrl}
                                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {file.mime_type.includes("pdf") ? (
                                    <FileIcon
                                      size={32}
                                      className="text-red-400"
                                    />
                                  ) : (
                                    <FileIcon
                                      size={32}
                                      className="text-gray-500"
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 4. FOOTER INFO */}
                            <div className="p-3 relative z-10 pointer-events-none">
                              {/* pointer-events-none allows clicks to pass through to wrapper, 
                                                        BUT we need buttons to be clickable, so we re-enable them below */}

                              <div className="flex justify-between items-start gap-2">
                                <span className="text-sm font-medium text-gray-200 truncate flex-1">
                                  {file.name}
                                </span>

                                {/* 5. CONTEXT MENU BUTTON (Pointer events enabled) */}
                                <div className="relative pointer-events-auto">
                                  <button
                                    onClick={(e) => handleMenuClick(e, file)}
                                    className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#2a2a30] rounded"
                                  >
                                    <MoreVertical size={16} />
                                  </button>

                                  {/* 6. THE MENU (Using the same component as List View) */}
                                  <FileContextMenu
                                    permission={getPermission(file)}
                                    isOpen={activeMenuId === file.id}
                                    onClose={() => setActiveMenuId(null)}
                                    position={menuPosition}
                                    item={file}
                                    isTrash={filter === "trash"} // <--- Pass the check
                                    actions={{
                                      onOpen: () => handleDoubleClick(file),
                                      onDownload: () => {
                                        handleDownload();
                                        setActiveMenuId(null);
                                      },
                                      onShare: () => {
                                        setSelectedItem(file);
                                        setIsAccessModalOpen(true);
                                        setActiveMenuId(null);
                                      },
                                      onRename: () => openRename(file),
                                      onMove: () => openMove(file),
                                      onCopy: () => handleCopy(file),
                                      onToggleStar: () => {
                                        handleToggleStar(file);
                                        setActiveMenuId(null);
                                      },
                                  onDelete: () => { handleDelete(file); setActiveMenuId(null); },

                                      // Restore Action (Reuse the handleRestore logic)
                                      onRestore: () => {
                                        setSelectedItem(file); // Ensure item is selected
                                        handleRestore();
                                        setActiveMenuId(null);
                                      },
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-500">
                                  {(file.size_bytes / 1024 / 1024).toFixed(1)}{" "}
                                  MB
                                </span>
                                {file.is_starred && (
                                  <Star
                                    size={10}
                                    className="fill-yellow-500 text-yellow-500"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {/* FLOATING ACTION BAR */}
      {selectedItem && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
            <div className="glass-panel px-6 py-3 rounded-full border border-border-dark bg-[#1e1e24]/90 backdrop-blur-xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
              <span className="text-sm font-medium text-gray-300 border-r border-gray-600 pr-4">
                1 item selected
              </span>

              {filter === "trash" ? (
                /* TRASH MODE: Show Restore (and Delete Forever if you want strict checks) */
                <button
                  onClick={handleRestore}
                  className="flex flex-col items-center gap-1 group"
                >
                  <RotateCcw
                    size={20}
                    className="text-gray-400 group-hover:text-green-400 transition-colors"
                  />
                  <span className="text-[10px] text-gray-500 group-hover:text-green-400 font-medium uppercase tracking-wide">
                    Restore
                  </span>
                </button>
              ) : (
                /* NORMAL MODE */
                <>
                  {/* 1. DOWNLOAD (Visible to Everyone) */}
                  <button
                    onClick={handleDownload}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <Download
                      size={20}
                      className="text-gray-400 group-hover:text-primary transition-colors"
                    />
                    <span className="text-[10px] text-gray-500 group-hover:text-primary font-medium uppercase tracking-wide">
                      Get
                    </span>
                  </button>

                  {/* 2. SHARE (Protected: Owner/Editor Only) */}
                  {canEdit(selectedItem) && (
                    <button
                      onClick={() => setIsAccessModalOpen(true)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <Share2
                        size={20}
                        className="text-gray-400 group-hover:text-primary transition-colors"
                      />
                      <span className="text-[10px] text-gray-500 group-hover:text-primary font-medium uppercase tracking-wide">
                        Share
                      </span>
                    </button>
                  )}

                  {/* 3. DELETE (Protected: Owner/Editor Only) */}
                  {canEdit(selectedItem) && (
                    <button
                      onClick={handleDelete}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <Trash2
                        size={20}
                        className="text-gray-400 group-hover:text-red-400 transition-colors"
                      />
                      <span className="text-[10px] text-gray-500 group-hover:text-red-400 font-medium uppercase tracking-wide">
                        Del
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3. RIGHT PANEL */}
      {selectedItem && (
        <RightPanel
          file={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDownload={handleDownload}
          onShare={() => setIsAccessModalOpen(true)}
          onOpen={() => handleDoubleClick(selectedItem)}
        />
      )}

      {/* MODALS */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => fetchContent(user.id, currentFolder, filter)}
        userId={user?.id}
        folderId={currentFolder}
        initialFile={null}
      />

      <RenameModal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        item={itemToRename}
        onRenameComplete={() => fetchContent(user.id, currentFolder, filter)}
      />
      {/* MOVE MODAL */}
      {fileToMove && (
        <MoveModal
          isOpen={isMoveModalOpen}
          onClose={() => {
            setIsMoveModalOpen(false);
            setFileToMove(null);
          }}
          file={fileToMove} // <--- PASS fileToMove HERE
          userId={user?.id}
          onMoveComplete={() => {
            fetchContent(user.id, currentFolder, filter);
            setIsMoveModalOpen(false);
            setFileToMove(null);
          }}
        />
      )}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        parentId={currentFolder}
        userId={user?.id}
        onFolderCreated={() => fetchContent(user.id, currentFolder, filter)}
      />

      {selectedItem && (
        <ManageAccessModal
          isOpen={isAccessModalOpen}
          onClose={() => setIsAccessModalOpen(false)}
          resourceId={selectedItem.id}
          resourceName={selectedItem.name}
          // IMPORTANT: Pass these new props
          resourceType={selectedItem.mime_type ? "file" : "folder"}
          ownerId={user?.id}
        />
      )}

      <CommandPalette
        userId={user?.id}
        onSelectFile={(f) => {
          setSelectedItem(f);
        }}
        onSelectFolder={(id) => {
          setCurrentFolder(id);
          setFilter("all");
        }}
      />
    </div>
  );
}




