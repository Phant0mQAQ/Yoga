import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/state/session";
import { useTheme } from "@/state/theme";
import { colors, radius, spacing } from "@/theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function Screen({
  title,
  eyebrow,
  children,
  action
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require("../../assets/icon.png")} style={styles.brandIcon} />
          <View style={styles.headerCopy}>
            <Text style={styles.brandName}>Yomi Yoga</Text>
            <Text style={styles.eyebrow}>{eyebrow ?? title}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {action}
          <AppearanceControls />
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}

export function AppearanceControls() {
  const { t } = useTranslation();
  const session = useSession();
  const theme = useTheme();

  async function cycleLanguage() {
    const locales = ["en", "zh-Hans", "ko"] as const;
    const currentIndex = locales.indexOf(session.locale as typeof locales[number]);
    const nextLocale = locales[(currentIndex + 1) % locales.length];
    await session.setLocale(nextLocale);
  }

  return (
    <View style={styles.appearanceControls}>
      <Pressable
        accessibilityLabel={t("changeLanguage")}
        onPress={() => void cycleLanguage()}
        style={({ pressed }) => [styles.preferenceButton, pressed && styles.pressed]}
      >
        <Text style={styles.languageCode}>{languageCode(session.locale)}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={theme.mode === "dark" ? t("lightMode") : t("darkMode")}
        onPress={() => void theme.toggleMode()}
        style={({ pressed }) => [styles.preferenceButton, pressed && styles.pressed]}
      >
        <Ionicons
          name={theme.mode === "dark" ? "sunny-outline" : "moon-outline"}
          size={18}
          color={colors.text}
        />
      </Pressable>
    </View>
  );
}

function languageCode(locale: string) {
  if (locale === "zh-Hans") return "中";
  if (locale === "ko") return "한";
  return "EN";
}

export function Card({
  children,
  tone = "default",
  style
}: {
  children: ReactNode;
  tone?: "default" | "sage" | "coral" | "ink";
  style?: object;
}) {
  return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
}

export function SectionHeader({
  title,
  meta,
  action
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  icon = "arrow-forward"
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.button,
      pressed && styles.pressed,
      disabled && styles.disabled
    ]}>
      <Text numberOfLines={2} style={styles.buttonText}>{title}</Text>
      <Ionicons name={icon} size={17} color={colors.white} />
    </Pressable>
  );
}

export function GhostButton({
  title,
  onPress,
  icon = "log-out-outline"
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={17} color={colors.text} />
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  secureTextEntry?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      style={styles.field}
    />
  );
}

export function Loading() {
  return (
    <SafeAreaView style={styles.loading}>
      <Image source={require("../../assets/icon.png")} style={styles.loadingMark} />
      <ActivityIndicator color={colors.accentDark} />
    </SafeAreaView>
  );
}

export function Row({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={2} style={[styles.rowValue, accent && styles.rowAccent]}>{value}</Text>
    </View>
  );
}

export function Pill({
  label,
  tone = "sage"
}: {
  label: string;
  tone?: "sage" | "coral" | "blue" | "neutral";
}) {
  return (
    <View style={[styles.pill, pillStyles[tone]]}>
      <Text style={[styles.pillText, pillTextStyles[tone]]}>{label.replaceAll("_", " ")}</Text>
    </View>
  );
}

export function Metric({
  label,
  value,
  icon,
  tone = "sage"
}: {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: "sage" | "coral" | "blue";
}) {
  const iconColor = tone === "coral" ? colors.coral : tone === "blue" ? colors.blue : colors.accentDark;
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const toneStyles = StyleSheet.create({
  default: {},
  sage: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  coral: { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft },
  ink: { backgroundColor: colors.black, borderColor: colors.black }
});

const pillStyles = StyleSheet.create({
  sage: { backgroundColor: colors.accentSoft },
  coral: { backgroundColor: colors.coralSoft },
  blue: { backgroundColor: colors.blueSoft },
  neutral: { backgroundColor: colors.surfaceMuted }
});

const pillTextStyles = StyleSheet.create({
  sage: { color: colors.accentDark },
  coral: { color: colors.coral },
  blue: { color: colors.blue },
  neutral: { color: colors.muted }
});

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  brandRow: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md
  },
  headerCopy: {
    minWidth: 0,
    flex: 1
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  appearanceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  preferenceButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  languageCode: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  brandName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  disabled: {
    opacity: 0.42
  },
  pressed: {
    opacity: 0.72
  },
  buttonText: {
    color: colors.white,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1
  },
  ghostButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  ghostText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg
  },
  loadingMark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg
  },
  row: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingVertical: spacing.sm
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 13
  },
  rowValue: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1
  },
  rowAccent: {
    color: colors.coral
  },
  pill: {
    minHeight: 27,
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize"
  },
  metric: {
    flex: 1,
    minWidth: 92,
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: "space-between"
  },
  metricValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12
  }
});
