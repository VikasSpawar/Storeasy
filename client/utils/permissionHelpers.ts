import { Permission } from "@/types/dashboard.types";

// In utils/permissionHelpers.ts - SIMPLEST SOLUTION
export function getPermission(item: any, userId: string): "owner" | "editor" | "viewer" {
  if (!userId || !item) return "viewer";
  if (item.owner_id === userId) return "owner";
  if (item.role) {
    // Type guard - ensure it's one of our values
    return (["owner", "editor", "viewer"] as const).includes(item.role as any) 
      ? item.role as "owner" | "editor" | "viewer"
      : "viewer";
  }
  return "viewer";
}


export function canEdit(item: any, userId: string): boolean {
  const perm = getPermission(item, userId);
  return perm === "owner" || perm === "editor";
}
