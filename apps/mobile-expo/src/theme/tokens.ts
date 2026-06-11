import { DynamicColorIOS, Platform } from "react-native";

function adaptive(light: string, dark: string) {
  return Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : light;
}

export const colors = {
  background: adaptive("#F7F6F2", "#101412"),
  surface: adaptive("#FFFFFF", "#181D1A"),
  surfaceMuted: adaptive("#EEF2EE", "#202722"),
  text: adaptive("#171B19", "#F4F6F4"),
  muted: adaptive("#6B746F", "#A7B0AA"),
  line: adaptive("#DDE2DD", "#303A34"),
  accent: adaptive("#6F8877", "#90A996"),
  accentDark: adaptive("#334C3D", "#3F5B49"),
  accentSoft: adaptive("#E4ECE5", "#233128"),
  coral: adaptive("#E85D4A", "#FF7867"),
  coralSoft: adaptive("#FBE8E4", "#382522"),
  blue: adaptive("#3B657A", "#76A9C0"),
  blueSoft: adaptive("#E5EEF2", "#213139"),
  danger: adaptive("#B33B33", "#FF8178"),
  warning: adaptive("#A26924", "#E5AF62"),
  success: adaptive("#39775A", "#75BF94"),
  white: "#FFFFFF",
  black: adaptive("#171B19", "#28322C")
};

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
