/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from "react";

// Theme Context for managing Light/Dark theme toggle
export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "dark";
    setTheme(savedTheme);
    applyTheme(savedTheme);
    setIsHydrated(true);
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
      {isHydrated ? children : null}
    </ThemeContext.Provider>
  );
};
