import * as SecureStore from "expo-secure-store";
import { Appearance, Platform, StatusBar } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { themePalettes } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeState | null>(null);
const themedStyleCache = new WeakMap<
  (colors: ThemeColors) => unknown,
  WeakMap<ThemeColors, unknown>
>();

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof document !== "undefined") {
        document.documentElement.style.colorScheme = mode;
      }
      return;
    }
    Appearance.setColorScheme(mode);
  }, [mode]);

  async function hydrate() {
    try {
      const storedMode = Platform.OS === "web"
        ? readWebThemeMode()
        : await SecureStore.getItemAsync("theme_mode");
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
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("theme_mode", nextMode);
        }
      } else {
        await SecureStore.setItemAsync("theme_mode", nextMode);
      }
    } catch {
      // The selected theme remains active for the current app session.
    }
  }

  const value = useMemo(
    () => ({ mode, colors: themePalettes[mode], toggleMode }),
    [mode]
  );

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

export function useThemedStyles<Styles>(factory: (colors: ThemeColors) => Styles) {
  const { colors } = useTheme();
  return useMemo(() => {
    let paletteCache = themedStyleCache.get(factory);
    if (!paletteCache) {
      paletteCache = new WeakMap<ThemeColors, unknown>();
      themedStyleCache.set(factory, paletteCache);
    }

    const cached = paletteCache.get(colors) as Styles | undefined;
    if (cached) return cached;

    const styles = factory(colors);
    paletteCache.set(colors, styles);
    return styles;
  }, [colors, factory]);
}

function readWebThemeMode() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("theme_mode");
}
