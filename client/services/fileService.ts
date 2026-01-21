const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const fileService = {
  // Fetch files for a folder
  async getFiles(userId: string, folderId: string | null, email: string) {
    const params = new URLSearchParams({
      userId,
      folderId: folderId || "",
      email,
    });
    const res = await fetch(`${API_URL}/api/files?${params}`);
    return res.json();
  },

  // Fetch shared files
  async getSharedFiles(email: string) {
    const res = await fetch(`${API_URL}/api/shared-with-me?email=${email}`);
    return res.json();
  },

  // Delete file (soft delete)
  async deleteFile(fileId: string, userId: string, email: string) {
    const res = await fetch(`${API_URL}/api/files/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, userId, email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }
    return res.json();
  },

  // Permanent delete
  async permanentDelete(userId: string, fileId: string, resourceType: "file" | "folder") {
    const res = await fetch(`${API_URL}/api/files/permanent`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fileId, resourceType }),
    });
    return res.json();
  },

  // Copy file
  async copyFile(userId: string, fileId: string) {
    const res = await fetch(`${API_URL}/api/files/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fileId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Copy failed");
    }
    return res.json();
  },

  // Toggle star
  async toggleStar(userId: string, fileId: string, value: boolean) {
    const res = await fetch(`${API_URL}/api/files/star`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fileId, value }),
    });
    return res.json();
  },

  // Restore from trash
  async restore(userId: string, resourceId: string, resourceType: "file" | "folder") {
    const res = await fetch(`${API_URL}/api/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resourceId, resourceType }),
    });
    return res.json();
  },

  // Empty trash
  async emptyTrash(userId: string) {
    const res = await fetch(`${API_URL}/api/trash/empty`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },
};
