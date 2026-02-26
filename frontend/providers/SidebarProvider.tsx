"use client";

import { createContext, useState } from "react";

export const SidebarContext = createContext(null);

export default function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen(!open);
  }

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
