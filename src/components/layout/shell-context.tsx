"use client";

import { createContext, useContext } from "react";

export interface ShellApi {
  openPalette: (query?: string) => void;
  openNewMeeting: () => void;
}

export const ShellContext = createContext<ShellApi>({
  openPalette: () => {},
  openNewMeeting: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}
