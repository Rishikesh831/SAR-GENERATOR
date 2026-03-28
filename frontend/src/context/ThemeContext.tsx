/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

// Theme Context for managing Light/Dark theme toggle
export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Default fallback so consumers never get undefined
const defaultThemeContext: ThemeContextType = {
  theme: "dark",
  toggleTheme: () => {},
};

export const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

// Co-locate the hook with the context to prevent HMR identity divergence
export const useTheme = (): ThemeContextType => {
  return useContext(ThemeContext);
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "dark";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // Apply theme to document root
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    // Remove both theme classes
    root.classList.remove("light", "dark");
    
    // Add the new theme class
    root.classList.add(newTheme);
    
    // Update data attribute for alternate theme selection methods
    root.setAttribute("data-theme", newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
