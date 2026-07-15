import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { bookings } from "@/api/client";
import type { Booking, LocalizedText } from "@/api/types";
import { GhostButton, Loading, Metric, Pill, QueryErrorNotice, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";

export default function CoachScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const query = useQuery({
    queryKey: ["coach-bookings", session.locale],
    queryFn: () => bookings(session.locale),
    enabled: Boolean(session.token)
  });

  if (query.isLoading) return <Loading />;
  if (query.error) {
    return (
      <Screen title={t("coach")} eyebrow={t("coachWorkspace")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <QueryErrorNotice
            title={t("coachDataErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void query.refetch()}
          />
        </ScrollView>
      </Screen>
    );
  }

  const rows = query.data ?? [];
  const confirmed = rows.filter((booking) => booking.status === "confirmed").length;
  const checkedIn = rows.filter((booking) => booking.status === "checked_in").length;

  return (
    <Screen title={t("coach")} eyebrow={t("coachWorkspace")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.kicker}>{t("todayAtGoodVibe")}</Text>
          <Text style={styles.heading}>{t("teachingDay")}</Text>
        </View>

        <View style={styles.metrics}>
          <Metric label={t("sessions")} value={rows.length} icon="calendar-outline" />
          <Metric label={t("confirmed")} value={confirmed} icon="people-outline" tone="blue" />
          <Metric label={t("arrived")} value={checkedIn} icon="checkmark-circle-outline" tone="coral" />
        </View>

        <View style={styles.availability}>
          <View style={styles.availabilityIcon}>
            <Ionicons name="time-outline" size={22} color={colors.accentDark} />
          </View>
          <View style={styles.availabilityCopy}>
            <Text style={styles.availabilityTitle}>{t("availabilityOpen")}</Text>
            <Text style={styles.availabilityMeta}>{t("availabilityOpenMeta")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>

        <SectionHeader title={t("scheduleView")} meta={`${rows.length} ${t("bookingsInView")}`} />
        <View style={styles.timeline}>
          {rows.map((booking, index) => (
            <View key={booking.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.dot, booking.status === "checked_in" && styles.dotComplete]} />
                {index < rows.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.bookingCard}>
                <View style={styles.bookingTop}>
                  <Text style={styles.bookingTime}>{formatTime(booking.startsAt, session.locale)}</Text>
                  <Pill label={t(bookingStatusKey(booking.status))} tone={bookingStatusTone(booking.status)} />
                </View>
                <Text style={styles.bookingTitle}>{localizedText(booking.course?.title, session.locale, booking.courseId)}</Text>
                <View style={styles.bookingMeta}>
                  <Ionicons name="person-circle-outline" size={17} color={colors.muted} />
                  <Text style={styles.bookingMetaText}>{booking.user?.name ?? t("studentBooking")}</Text>
                </View>
              </View>
            </View>
          ))}
          {!rows.length ? <Text style={styles.empty}>{t("noScheduledClasses")}</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function bookingStatusKey(status: Booking["status"]) {
  if (status === "pending_payment") return "statusPendingPayment" as const;
  if (status === "confirmed") return "statusConfirmed" as const;
  if (status === "cancelled") return "statusCancelled" as const;
  return "statusCheckedIn" as const;
}

function bookingStatusTone(status: Booking["status"]): "sage" | "blue" | "neutral" {
  if (status === "pending_payment") return "blue";
  if (status === "cancelled") return "neutral";
  return "sage";
}

function localizedText(value: string | LocalizedText | undefined, locale: string, fallback: string) {
  if (typeof value === "string") return value;
  if (!value) return fallback;
  const localized = value as Record<string, string | undefined>;
  return localized[locale]
    ?? (locale === "zh-Hans" ? localized.zh : undefined)
    ?? localized.en
    ?? fallback;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  kicker: { color: colors.coral, fontSize: 10, fontWeight: "800" },
  heading: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: spacing.xs, maxWidth: 330 },
  accent: { color: colors.accent },
  metrics: { flexDirection: "row", gap: spacing.sm },
  availability: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.lg },
  availabilityIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  availabilityCopy: { flex: 1 },
  availabilityTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  availabilityMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: spacing.md, minHeight: 132 },
  timelineRail: { width: 18, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.blue, marginTop: 18, borderWidth: 3, borderColor: colors.blueSoft },
  dotComplete: { backgroundColor: colors.accent, borderColor: colors.accentSoft },
  line: { width: 1, flex: 1, backgroundColor: colors.line, marginTop: 4 },
  bookingCard: { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  bookingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  bookingTime: { color: colors.coral, fontSize: 13, fontWeight: "800" },
  bookingTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: spacing.md },
  bookingMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  bookingMetaText: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xxl }
  });
}
