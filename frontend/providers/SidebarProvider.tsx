"use client";

import React, { createContext, useState, ReactNode } from "react";

type SidebarContextType = {
  open: boolean;
  toggle: () => void;
};

export const SidebarContext = createContext<SidebarContextType | null>(null);

export default function SidebarProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(false);

  function toggle() {
    setOpen((prev) => !prev);
  }

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
