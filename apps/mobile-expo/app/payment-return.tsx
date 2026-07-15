import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PrimaryButton, Screen } from "@/components/ui";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";

type ReturnStatus = "success" | "cancel" | "pending";

export default function PaymentReturnScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const status = normalizeReturnStatus(params.status);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const presentation = returnPresentation(status, colors);

  useEffect(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["availability"] }),
      queryClient.invalidateQueries({ queryKey: ["member-cards"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    ]);
  }, [queryClient]);

  return (
    <Screen title={t("paymentReturnTitle")} eyebrow={t("studentStudio")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="alert" style={styles.card}>
          <View style={[styles.icon, { backgroundColor: presentation.backgroundColor }]}>
            <Ionicons name={presentation.icon} size={38} color={presentation.color} />
          </View>
          <Text selectable style={styles.title}>{t(presentation.titleKey)}</Text>
          <Text selectable style={styles.message}>{t(presentation.messageKey)}</Text>
          <PrimaryButton
            title={session.role ? t("backToStudio") : t("signIn")}
            icon="arrow-forward"
            onPress={() => router.replace(destinationForRole(session.role))}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function normalizeReturnStatus(value?: string | string[]): ReturnStatus {
  const status = Array.isArray(value) ? value[0] : value;
  if (status === "success") return "success";
  if (status === "cancel" || status === "cancelled" || status === "canceled") return "cancel";
  return "pending";
}

function returnPresentation(status: ReturnStatus, colors: ThemeColors) {
  if (status === "success") {
    return {
      icon: "checkmark-circle" as const,
      color: colors.success,
      backgroundColor: colors.accentSoft,
      titleKey: "paymentReturnSuccessTitle",
      messageKey: "paymentReturnSuccessMessage"
    };
  }
  if (status === "cancel") {
    return {
      icon: "time-outline" as const,
      color: colors.warning,
      backgroundColor: colors.coralSoft,
      titleKey: "paymentReturnCancelledTitle",
      messageKey: "paymentReturnCancelledMessage"
    };
  }
  return {
    icon: "hourglass-outline" as const,
    color: colors.blue,
    backgroundColor: colors.blueSoft,
    titleKey: "paymentReturnPendingTitle",
    messageKey: "paymentReturnPendingMessage"
  };
}

function destinationForRole(role: ReturnType<typeof useSession>["role"]) {
  if (role === "student") return "/(student)" as const;
  if (role === "coach") return "/(coach)" as const;
  if (role === "staff") return "/(staff)" as const;
  if (role === "admin") return "/(admin)" as const;
  return "/(auth)" as const;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: "center"
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.xl
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800"
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21
  }
  });
}
