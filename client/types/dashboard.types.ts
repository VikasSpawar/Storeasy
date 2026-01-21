export type FilterType = "all" | "shared" | "starred" | "trash" | "recent";
export type ViewMode = "list" | "grid";
export type Permission = "owner" | "editor" | "viewer";

export type PermissionOrString = Permission | string;

export interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  owner_id: string;
  folder_id: string | null;
  is_deleted: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  publicUrl?: string;
  role?: Permission;
}

export interface FolderItem {
  id: string;
  name: string;
  owner_id: string;
  parent_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  role?: Permission;
}

export interface Breadcrumb {
  id: string;
  name: string;
}
