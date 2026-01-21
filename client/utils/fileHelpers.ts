import { supabase } from "@/lib/supabaseClient";
import { FileItem } from "@/types/dashboard.types";

export async function signUrls(fileList: FileItem[]): Promise<FileItem[]> {
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
    })
  );
}

export function formatFileSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
