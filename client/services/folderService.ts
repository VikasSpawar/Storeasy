const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const folderService = {
  // Delete folder
  async deleteFolder(folderId: string, userId: string, email: string) {
    const res = await fetch(`${API_URL}/api/folders/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, userId, email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Delete failed");
    }
    return res.json();
  },
};
