"use client";

import { createContext, useContext } from "react";

export const ShellContext = createContext<{ openPalette: () => void; openCapture: () => void }>({
  openPalette: () => {},
  openCapture: () => {},
});

export const useShell = () => useContext(ShellContext);
