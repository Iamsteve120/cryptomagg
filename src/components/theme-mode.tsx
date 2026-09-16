import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "cryptomagg-theme";

const ThemeContext = createContext<{ theme: ThemeMode; setTheme: (mode: ThemeMode) => void }>({
  theme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  // Read after hydration so server and client render the same markup.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setThemeState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { theme, setTheme } = useThemeMode();
  return (
    <Button
      variant="outline"
      size="sm"
      className="group h-9 gap-1 rounded-full bg-card/80 px-1.5 shadow-sm"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span className={theme === "light" ? "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex size-6 items-center justify-center rounded-full text-muted-foreground"}>
        <Sun className="size-3.5" />
      </span>
      <span className={theme === "dark" ? "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex size-6 items-center justify-center rounded-full text-muted-foreground"}>
        <Moon className="size-3.5" />
      </span>
    </Button>
  );
}
