import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { ActionSheetIOS, Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Role } from "@/api/types";
import { Field, GhostButton, PrimaryButton, Screen } from "@/components/ui";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { localizedApiError } from "@/utils/api-error";

type AuthMode = "signIn" | "register";
const roles: Role[] = ["student", "coach", "admin"];

export default function AuthScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const [role, setRole] = useState<Role>("student");
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState(__DEV__ ? "student@example.com" : "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(__DEV__ ? "GoodVibe@2026" : "");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [coachInviteCode, setCoachInviteCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const styles = useThemedStyles(createStyles);

  function revealForm() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  }

  async function submit() {
    if (requestInFlight.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    const alertTitle = t(mode === "signIn" ? "signInFailed" : "registrationFailed");
    if (!isEmail(normalizedEmail)) return Alert.alert(alertTitle, t("invalidEmail"));
    if (!password) return Alert.alert(alertTitle, t("enterPassword"));
    if (mode === "register") {
      if (role === "admin") return Alert.alert(alertTitle, t("roleRegistrationRestricted"));
      if (name.trim().length < 2) return Alert.alert(alertTitle, t("invalidName"));
      if (password !== passwordConfirmation) return Alert.alert(alertTitle, t("passwordsDoNotMatch"));
      if (role === "coach" && !coachInviteCode.trim()) {
        return Alert.alert(alertTitle, t("coachInviteCodeRequired"));
      }
    }

    requestInFlight.current = true;
    setBusy(true);
    try {
      if (mode === "register") {
        const response = await session.register(
          name.trim(),
          normalizedEmail,
          password,
          role,
          role === "coach" ? coachInviteCode.trim() : undefined
        );
        setPendingEmail(response.email);
      } else {
        await session.login(normalizedEmail, password, role);
      }
    } catch (error) {
      if ((error as { code?: string })?.code === "email_not_verified") setPendingEmail(normalizedEmail);
      Alert.alert(alertTitle, localizedApiError(error, t));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function verifyEmail() {
    if (!pendingEmail || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      await session.verifyEmail(pendingEmail, password, role);
    } catch (error) {
      Alert.alert(t("verificationFailed"), localizedApiError(error, t));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!pendingEmail || requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      await session.resendEmailVerification(pendingEmail, password);
      Alert.alert(t("verificationEmailSent"), t("verificationSentTo", { email: pendingEmail }));
    } catch (error) {
      Alert.alert(t("verificationFailed"), localizedApiError(error, t));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function chooseRole(nextRole: Role) {
    const nextMode = nextRole === "admin" ? "signIn" : mode;
    setRole(nextRole);
    setMode(nextMode);
    setName("");
    setEmail(__DEV__ && nextMode === "signIn" ? defaultEmail(nextRole) : "");
    setPassword(__DEV__ && nextMode === "signIn" ? "GoodVibe@2026" : "");
    setPasswordConfirmation("");
    setCoachInviteCode("");
    setPendingEmail(null);
  }

  function chooseMode(nextMode: AuthMode) {
    if (role === "admin" && nextMode === "register") return;
    setMode(nextMode);
    setName("");
    setEmail(__DEV__ && nextMode === "signIn" ? defaultEmail(role) : "");
    setPassword(__DEV__ && nextMode === "signIn" ? "GoodVibe@2026" : "");
    setPasswordConfirmation("");
    setCoachInviteCode("");
    setPendingEmail(null);
  }

  return (
    <Screen
      title={t("accountAccess")}
      eyebrow={t("authRoleHint")}
      action={session.role || pendingEmail ? null : <RoleSwitcher role={role} onSelect={chooseRole} />}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets={process.env.EXPO_OS === "ios"}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scroll}
          keyboardDismissMode={process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.intro}>
          <Image
            accessibilityLabel="Good Vibe Pilates & Yoga logo"
            resizeMode="contain"
            source={require("../../assets/good-vibe-logo.png")}
            style={styles.logo}
          />
          <Text style={styles.tagline}>{t("tagline")}</Text>
          <Text style={styles.introCopy}>{t("intro")}</Text>
        </View>

        <View style={styles.form}>
          {pendingEmail ? (
            <>
              <View style={styles.verificationIcon}>
                <Ionicons name="mail-unread-outline" size={28} color={styles.verificationIconText.color} />
              </View>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>{t("verifyYourEmail")}</Text>
                <Text selectable style={styles.formMeta}>{t("verificationSentTo", { email: pendingEmail })}</Text>
              </View>
              <PrimaryButton
                title={busy ? t("pleaseWait") : t("verifyEmail")}
                icon="checkmark-circle-outline"
                onPress={() => void verifyEmail()}
                disabled={busy}
              />
              <GhostButton title={t("resendVerificationCode")} icon="refresh-outline" onPress={() => void resendCode()} />
              <GhostButton title={t("useDifferentEmail")} icon="arrow-back" onPress={() => setPendingEmail(null)} />
              <Text style={styles.securityNote}>{t("verificationCodeExpiry")}</Text>
            </>
          ) : (
            <>
              {role === "admin" ? null : (
                <SegmentedChoice
                  options={[
                    { value: "signIn", label: t("signIn") },
                    { value: "register", label: t("register") }
                  ]}
                  value={mode}
                  onChange={chooseMode}
                />
              )}
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>{t(mode)} · {t(role)}</Text>
                <Text style={styles.formMeta}>{t("roleLocked")}</Text>
              </View>
              {mode === "register" ? <Field value={name} onChangeText={setName} onFocus={revealForm} placeholder={t("fullName")} /> : null}
              <Field value={email} onChangeText={setEmail} onFocus={revealForm} placeholder={t("emailPlaceholder")} keyboardType="email-address" />
              {mode === "register" && role === "coach" ? (
                <Field
                  value={coachInviteCode}
                  onChangeText={setCoachInviteCode}
                  onFocus={revealForm}
                  placeholder={t("coachInviteCode")}
                  secureTextEntry
                />
              ) : null}
              <Field value={password} onChangeText={setPassword} onFocus={revealForm} placeholder={t("password")} secureTextEntry />
              {mode === "register" ? (
                <Field value={passwordConfirmation} onChangeText={setPasswordConfirmation} onFocus={revealForm} placeholder={t("confirmPassword")} secureTextEntry />
              ) : null}
              {role === "admin" ? (
                <View style={styles.restrictedNotice}>
                  <Ionicons name="shield-checkmark-outline" size={19} color={styles.restrictedText.color} />
                  <Text selectable style={styles.restrictedText}>{t("adminSignInOnly")}</Text>
                </View>
              ) : null}
              {mode === "register" && role === "coach" ? (
                <Text style={styles.securityNote}>{t("coachInviteHint")}</Text>
              ) : null}
              <PrimaryButton
                title={busy ? t("pleaseWait") : t(mode)}
                icon={mode === "register" ? "person-add-outline" : "arrow-forward"}
                onPress={() => void submit()}
                disabled={
                  busy
                  || !email.trim()
                  || !password
                  || (mode === "register" && role === "coach" && !coachInviteCode.trim())
                }
              />
              {__DEV__ && mode === "signIn" ? <Text style={styles.demoNote}>{t("demoPassword")}: GoodVibe@2026</Text> : null}
              {mode === "register" ? <Text style={styles.securityNote}>{t("passwordRequirement")}</Text> : null}
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function RoleSwitcher({ role, onSelect }: { role: Role; onSelect: (role: Role) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [webMenuOpen, setWebMenuOpen] = useState(false);

  function showRoles() {
    if (process.env.EXPO_OS === "web") {
      setWebMenuOpen((open) => !open);
      return;
    }
    if (process.env.EXPO_OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({
        title: t("switchRole"),
        options: [...roles.map((item) => t(item)), t("cancel")],
        cancelButtonIndex: roles.length
      }, (index) => {
        const selectedRole = roles[index];
        if (selectedRole) onSelect(selectedRole);
      });
      return;
    }
    Alert.alert(t("switchRole"), undefined, [
      ...roles.map((item) => ({ text: t(item), onPress: () => onSelect(item) })),
      { text: t("cancel"), style: "cancel" as const }
    ]);
  }

  return (
    <View style={styles.roleSwitcherContainer}>
      <Pressable
        accessibilityLabel={t("switchRole")}
        accessibilityHint={t("roleLocked")}
        accessibilityState={{ expanded: webMenuOpen }}
        onPress={showRoles}
        style={({ pressed }) => [styles.roleSwitcher, pressed && styles.pressed]}
      >
        <Ionicons name={roleIcon(role)} size={16} color={colors.text} />
        <Text numberOfLines={1} style={styles.roleSwitcherText}>{t(role)}</Text>
        <Ionicons name="chevron-down" size={13} color={colors.muted} />
      </Pressable>
      {process.env.EXPO_OS === "web" && webMenuOpen ? (
        <View style={styles.webRoleMenu}>
          {roles.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: role === item }}
              onPress={() => {
                onSelect(item);
                setWebMenuOpen(false);
              }}
              style={({ pressed }) => [styles.webRoleOption, role === item && styles.webRoleOptionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.webRoleOptionText, role === item && styles.webRoleOptionTextSelected]}>{t(item)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SegmentedChoice<T extends string>({ options, value, onChange }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmentedChoice}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segmentButton, selected && styles.segmentButtonSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function roleIcon(role: Role): "person-outline" | "body-outline" | "options-outline" {
  if (role === "coach") return "body-outline";
  if (role === "admin") return "options-outline";
  return "person-outline";
}

function defaultEmail(role: Role) {
  if (role === "coach") return "coach@example.com";
  if (role === "admin") return "admin@example.com";
  return "student@example.com";
}

function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    keyboardAvoider: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
    intro: { alignItems: "center", paddingVertical: spacing.md },
    logo: { width: 176, height: 208, borderRadius: radius.lg, marginBottom: spacing.sm },
    tagline: { color: colors.coral, fontSize: 15, fontWeight: "800", marginTop: spacing.xs },
    introCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 330, marginTop: spacing.sm },
    roleSwitcherContainer: { position: "relative", zIndex: 20 },
    roleSwitcher: { minWidth: 92, maxWidth: 122, height: 38, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    roleSwitcherText: { color: colors.text, fontSize: 12, fontWeight: "800", flexShrink: 1 },
    webRoleMenu: { position: "absolute", top: 42, right: 0, minWidth: 132, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 2, zIndex: 30 },
    webRoleOption: { minHeight: 34, paddingHorizontal: spacing.sm, borderRadius: radius.sm, justifyContent: "center" },
    webRoleOptionSelected: { backgroundColor: colors.accentDark },
    webRoleOptionText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    webRoleOptionTextSelected: { color: colors.white },
    form: { gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderCurve: "continuous" },
    formHeading: { gap: 3 },
    formTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
    formMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    segmentedChoice: { minHeight: 42, padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, flexDirection: "row", gap: 3 },
    segmentButton: { flex: 1, minHeight: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
    segmentButtonSelected: { backgroundColor: colors.accentDark },
    segmentText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    segmentTextSelected: { color: colors.white },
    restrictedNotice: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.coralSoft, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    restrictedText: { color: colors.coral, fontSize: 12, lineHeight: 18, flex: 1 },
    verificationIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
    verificationIconText: { color: colors.accentDark },
    demoNote: { color: colors.muted, fontSize: 12, textAlign: "center" },
    securityNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
    pressed: { opacity: 0.72 }
  });
}
