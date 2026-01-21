"use client";

import { useState } from "react";
import { fileService } from "@/services/fileService";
import { folderService } from "@/services/folderService";
import { FilterType } from "@/types/dashboard.types";

export function useFileActions(
  userId: string | null,
  userEmail: string,
  filter: FilterType,
  refetch: () => void
) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [itemToRename, setItemToRename] = useState<any>(null);
  const [fileToMove, setFileToMove] = useState<any>(null);

  const handleDoubleClick = (item: any) => {
    if (!item.mime_type) {
      // It's a folder
      return { action: "openFolder", folderId: item.id };
    } else {
      // It's a file
      if (item.publicUrl) window.open(item.publicUrl, "_blank");
      else alert("No preview available for this file type.");
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || !userId) return;

    const isPermanent = filter === "trash";
    const message = isPermanent
      ? "Permanently delete this item? This cannot be undone."
      : "Move to trash?";

    if (!confirm(message)) return;

    try {
      if (isPermanent) {
        await fileService.permanentDelete(
          userId,
          selectedItem.id,
          selectedItem.mime_type ? "file" : "folder"
        );
      } else {
        const isFile = !!selectedItem.mime_type;
        if (isFile) {
          await fileService.deleteFile(selectedItem.id, userId, userEmail);
        } else {
          await folderService.deleteFolder(selectedItem.id, userId, userEmail);
        }
      }

      refetch();
      setSelectedItem(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(err.message || "Failed to delete item.");
    }
  };

  const handleRestore = async () => {
    if (!selectedItem || !userId) return;
    await fileService.restore(
      userId,
      selectedItem.id,
      selectedItem.mime_type ? "file" : "folder"
    );
    refetch();
    setSelectedItem(null);
  };

  const handleDownload = async () => {
    if (selectedItem?.publicUrl) {
      const link = document.createElement("a");
      link.href = selectedItem.publicUrl;
      link.download = selectedItem.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopy = async (item: any) => {
    if (!userId) return;
    try {
      await fileService.copyFile(userId, item.id);
      refetch();
      alert("File copied successfully!");
    } catch (err: any) {
      console.error("Copy Error:", err);
      alert(`Failed to copy: ${err.message}`);
    }
  };

  const handleToggleStar = async (item: any, files: any[], setFiles: any) => {
    if (!userId) return;
    const newValue = !item.is_starred;
    setFiles(
      files.map((f) => (f.id === item.id ? { ...f, is_starred: newValue } : f))
    );

    try {
      await fileService.toggleStar(userId, item.id, newValue);
    } catch (err) {
      console.error(err);
      refetch();
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm("Are you sure you want to EMPTY the trash? All items will be lost forever."))
      return;

    try {
      await fileService.emptyTrash(userId!);
      refetch();
    } catch (err) {
      console.error(err);
      alert("Failed to empty trash");
    }
  };

  return {
    selectedItem,
    setSelectedItem,
    itemToRename,
    setItemToRename,
    fileToMove,
    setFileToMove,
    handleDoubleClick,
    handleDelete,
    handleRestore,
    handleDownload,
    handleCopy,
    handleToggleStar,
    handleEmptyTrash,
  };
}
