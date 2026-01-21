"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { signUrls } from "@/utils/fileHelpers";
import { fileService } from "@/services/fileService";
import { FilterType, FileItem, FolderItem, Breadcrumb } from "@/types/dashboard.types";

export function useDashboardData(
  userId: string | null,
  currentFolder: string | null,
  filter: FilterType,
  userEmail: string
) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchContent(userId, currentFolder, filter);
    }
  }, [userId, currentFolder, filter]);

  async function fetchContent(
    userId: string,
    folderId: string | null,
    currentFilter: FilterType
  ) {
    setLoading(true);
    setFiles([]);
    setFolders([]);

    try {
      // SHARED WITH ME
      if (currentFilter === "shared") {
        const data = await fileService.getSharedFiles(userEmail);
        const signedFiles = await signUrls(data.files || []);
        setFiles(signedFiles);
        setFolders(data.folders || []);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // TRASH
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

        setFiles(await signUrls(trashFiles || []));
        setFolders(trashFolders || []);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // RECENT
      if (currentFilter === "recent") {
        const { data: recentFiles } = await supabase
          .from("files")
          .select("*")
          .eq("owner_id", userId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(20);

        setFiles(await signUrls(recentFiles || []));
        setFolders([]);
        setBreadcrumbs([]);
        setLoading(false);
        return;
      }

      // STANDARD (MY DRIVE / STARRED)
      // Fetch Folders
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

      // Fetch Files
      let fetchedFiles = await fileService.getFiles(userId, folderId, userEmail);

      if (currentFilter === "starred") {
        fetchedFiles = fetchedFiles.filter((f: FileItem) => f.is_starred);
      }

      setFiles(fetchedFiles || []);

      // Breadcrumbs
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

  return {
    files,
    folders,
    breadcrumbs,
    loading,
    setFiles,
    refetch: () => fetchContent(userId!, currentFolder, filter),
  };
}
