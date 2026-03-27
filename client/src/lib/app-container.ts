import { createContext, useContext } from "react";

export const AppContainerContext = createContext<HTMLElement | null>(null);

export function useAppContainer() {
  return useContext(AppContainerContext);
}
