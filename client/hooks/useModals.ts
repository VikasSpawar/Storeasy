"use client";

import { useState } from "react";

export function useModals() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  return {
    upload: { isOpen: isUploadOpen, open: () => setIsUploadOpen(true), close: () => setIsUploadOpen(false) },
    folder: { isOpen: isFolderModalOpen, open: () => setIsFolderModalOpen(true), close: () => setIsFolderModalOpen(false) },
    access: { isOpen: isAccessModalOpen, open: () => setIsAccessModalOpen(true), close: () => setIsAccessModalOpen(false) },
    move: { isOpen: isMoveModalOpen, open: () => setIsMoveModalOpen(true), close: () => setIsMoveModalOpen(false) },
    rename: { isOpen: isRenameOpen, open: () => setIsRenameOpen(true), close: () => setIsRenameOpen(false) },
  };
}
