export const lightColors = {
  background: "#F7F6F2",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2EE",
  text: "#171B19",
  muted: "#6B746F",
  line: "#DDE2DD",
  accent: "#6F8877",
  accentDark: "#334C3D",
  accentSoft: "#E4ECE5",
  coral: "#E85D4A",
  coralSoft: "#FBE8E4",
  blue: "#3B657A",
  blueSoft: "#E5EEF2",
  danger: "#B33B33",
  warning: "#A26924",
  success: "#39775A",
  onDarkSubtle: "#AAB8AF",
  onDarkMuted: "#C8CECA",
  onAccentMuted: "#C5D0C9",
  scannerMuted: "#C7D2CB",
  progressTrack: "#3A403D",
  white: "#FFFFFF",
  black: "#171B19"
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#101412",
  surface: "#181D1A",
  surfaceMuted: "#202722",
  text: "#F4F6F4",
  muted: "#A7B0AA",
  line: "#303A34",
  accent: "#90A996",
  accentDark: "#3F5B49",
  accentSoft: "#233128",
  coral: "#FF7867",
  coralSoft: "#382522",
  blue: "#76A9C0",
  blueSoft: "#213139",
  danger: "#FF8178",
  warning: "#E5AF62",
  success: "#75BF94",
  onDarkSubtle: "#BDCBC2",
  onDarkMuted: "#D7E0DA",
  onAccentMuted: "#D5E0D9",
  scannerMuted: "#D5E0D9",
  progressTrack: "#4A564F",
  white: "#FFFFFF",
  black: "#28322C"
};

export const themePalettes = {
  light: lightColors,
  dark: darkColors
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12
};
