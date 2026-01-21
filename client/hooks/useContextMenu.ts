"use client";

import { useState } from "react";

export function useContextMenu() {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleMenuClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();

    if (activeMenuId === itemId) {
      setActiveMenuId(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({
      x: rect.right,
      y: rect.bottom,
    });

    setActiveMenuId(itemId);
  };

  const closeMenu = () => setActiveMenuId(null);

  return {
    activeMenuId,
    menuPosition,
    handleMenuClick,
    closeMenu,
  };
}
