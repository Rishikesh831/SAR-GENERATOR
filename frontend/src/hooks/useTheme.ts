// Re-export from ThemeContext (single source of truth)
// This avoids HMR context identity issues that occur when
// useContext is called from a different module than createContext.
export { useTheme } from "@/context/ThemeContext";
export type { ThemeContextType } from "@/context/ThemeContext";
