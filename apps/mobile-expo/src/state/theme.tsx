import * as SecureStore from "expo-secure-store";
import { Appearance, Platform, StatusBar } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  toggleMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.style.colorScheme = mode;
      return;
    }
    Appearance.setColorScheme(mode);
  }, [mode]);

  async function hydrate() {
    try {
      const storedMode = await SecureStore.getItemAsync("theme_mode");
      if (storedMode === "light" || storedMode === "dark") {
        setMode(storedMode);
      }
    } catch {
      // Keep the system-derived theme when secure storage is unavailable.
    }
  }

  async function toggleMode() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    try {
      await SecureStore.setItemAsync("theme_mode", nextMode);
    } catch {
      // The selected theme remains active for the current app session.
    }
  }

  const value = useMemo(() => ({ mode, toggleMode }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
