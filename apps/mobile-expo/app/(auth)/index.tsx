import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Role } from "@/api/types";
import { AppearanceControls, Field, PrimaryButton } from "@/components/ui";
import { useSession } from "@/state/session";
import { colors, radius, spacing } from "@/theme/tokens";

const primaryRoles: Array<{ role: Role; label: string; icon: "person-outline" | "body-outline" }> = [
  { role: "student", label: "student", icon: "person-outline" },
  { role: "coach", label: "coach", icon: "body-outline" }
];

export default function AuthScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("Yomi@2026");
  const [busy, setBusy] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const requestInFlight = useRef(false);

  async function signIn() {
    if (requestInFlight.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return Alert.alert(t("signInFailed"), t("enterEmail"));
    if (!password) return Alert.alert(t("signInFailed"), t("enterPassword"));

    requestInFlight.current = true;
    setBusy(true);
    try {
      await session.login(normalizedEmail, password, role);
    } catch (error) {
      Alert.alert(t("signInFailed"), errorMessage(error));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
    setEmail(defaultEmail(nextRole));
    setPassword("Yomi@2026");
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.preferenceRow}>
          <AppearanceControls />
        </View>

        <View style={styles.intro}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
          <Text style={styles.brand}>Yomi Yoga</Text>
          <Text style={styles.tagline}>{t("tagline")}</Text>
          <Text style={styles.introCopy}>{t("intro")}</Text>
        </View>

        <View style={styles.roleSection}>
          <Text style={styles.label}>{t("continueAs")}</Text>
          <View style={styles.roleGrid}>
            {primaryRoles.map((item) => (
              <RoleButton
                key={item.role}
                label={t(item.label)}
                icon={item.icon}
                selected={role === item.role}
                onPress={() => chooseRole(item.role)}
              />
            ))}
          </View>
          <Pressable onPress={() => setShowOperations((value) => !value)} style={styles.operationsToggle}>
            <Ionicons name="key-outline" size={17} color={colors.muted} />
            <Text style={styles.operationsText}>{t("studioOperations")}</Text>
            <Ionicons name={showOperations ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
          </Pressable>
          {showOperations ? (
            <View style={styles.operationRoles}>
              <RoleButton label={t("staff")} icon="scan-outline" selected={role === "staff"} onPress={() => chooseRole("staff")} compact />
              <RoleButton label={t("admin")} icon="options-outline" selected={role === "admin"} onPress={() => chooseRole("admin")} compact />
            </View>
          ) : null}
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>{t("signIn")} · {t(role)}</Text>
          <Field value={email} onChangeText={setEmail} placeholder={t("email")} keyboardType="email-address" />
          <Field value={password} onChangeText={setPassword} placeholder={t("password")} secureTextEntry />
          <PrimaryButton
            title={busy ? t("pleaseWait") : t("signIn")}
            icon="arrow-forward"
            onPress={() => void signIn()}
            disabled={busy || !email.trim() || !password}
          />
          <Text style={styles.demoNote}>{t("demoPassword")}: Yomi@2026</Text>
          <Text style={styles.securityNote}>{t("roleLocked")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function RoleButton({
  label,
  icon,
  selected,
  onPress,
  compact = false
}: {
  label: string;
  icon: "person-outline" | "body-outline" | "scan-outline" | "options-outline";
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.roleButton,
      compact && styles.compactRole,
      selected && styles.roleButtonActive,
      pressed && styles.pressed
    ]}>
      <Ionicons name={icon} size={compact ? 19 : 24} color={selected ? colors.white : colors.text} />
      <Text style={[styles.roleText, selected && styles.roleTextActive]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.white} /> : null}
    </Pressable>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function defaultEmail(role: Role) {
  if (role === "coach") return "coach@example.com";
  if (role === "staff") return "staff@example.com";
  if (role === "admin") return "admin@example.com";
  return "student@example.com";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  preferenceRow: { minHeight: 40, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  intro: { alignItems: "center", paddingVertical: spacing.lg },
  logo: { width: 88, height: 88, borderRadius: radius.lg, marginBottom: spacing.lg },
  brand: { color: colors.text, fontSize: 36, fontWeight: "800" },
  tagline: { color: colors.coral, fontSize: 15, fontWeight: "800", marginTop: spacing.xs },
  introCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 330, marginTop: spacing.sm },
  roleSection: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  roleGrid: { flexDirection: "row", gap: spacing.sm },
  roleButton: {
    flex: 1,
    minHeight: 84,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    justifyContent: "space-between"
  },
  compactRole: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: spacing.sm },
  roleButtonActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  roleText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  roleTextActive: { color: colors.white },
  operationsToggle: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  operationsText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  operationRoles: { flexDirection: "row", gap: spacing.sm },
  form: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line },
  formTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: spacing.xs },
  demoNote: { color: colors.muted, fontSize: 12, textAlign: "center" },
  securityNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  pressed: { opacity: 0.72 }
});
