import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { bookings, checkIn } from "@/api/client";
import { GhostButton, Loading, Metric, Pill, PrimaryButton, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { colors, radius, spacing } from "@/theme/tokens";

export default function StaffScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const query = useQuery({
    queryKey: ["staff-bookings", session.locale],
    queryFn: () => bookings(session.locale),
    enabled: Boolean(session.token)
  });

  if (query.isLoading) return <Loading />;

  const rows = query.data ?? [];
  const pending = rows.filter((booking) => booking.status !== "checked_in" && booking.status !== "cancelled").length;
  const arrived = rows.filter((booking) => booking.status === "checked_in").length;

  async function runCheckIn(bookingId: string) {
    try {
      await checkIn(bookingId);
      Alert.alert("Checked in", "The booking is now marked as arrived.");
      await query.refetch();
    } catch (error) {
      Alert.alert("Unable to check in", error instanceof Error ? error.message : "Request failed");
    }
  }

  return (
    <Screen title={t("staff")} eyebrow={t("frontDesk")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="scan-outline" size={28} color={colors.white} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t("readyForArrivals")}</Text>
            <Text style={styles.heroMeta}>{t("arrivalsMeta")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7D2CB" />
        </View>

        <View style={styles.metrics}>
          <Metric label={t("todayList")} value={rows.length} icon="list-outline" />
          <Metric label={t("waiting")} value={pending} icon="time-outline" tone="coral" />
          <Metric label={t("arrived")} value={arrived} icon="checkmark-done-outline" tone="blue" />
        </View>

        <SectionHeader title={t("arrivalList")} meta={t("arrivalListMeta")} />
        <View style={styles.list}>
          {rows.map((booking) => {
            const completed = booking.status === "checked_in";
            return (
              <View key={booking.id} style={styles.booking}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(booking.user?.name ?? booking.userId)}</Text>
                </View>
                <View style={styles.bookingCopy}>
                  <View style={styles.bookingNameRow}>
                    <Text style={styles.bookingName}>{booking.user?.name ?? booking.userId}</Text>
                    <Pill label={booking.status} tone={completed ? "sage" : "coral"} />
                  </View>
                  <Text style={styles.course}>{String(booking.course?.title ?? booking.courseId)}</Text>
                  <Text style={styles.time}>{new Date(booking.startsAt).toLocaleString()}</Text>
                  <View style={styles.action}>
                    <PrimaryButton
                      title={completed ? t("checkedIn") : t("manualCheckIn")}
                      icon={completed ? "checkmark" : "enter-outline"}
                      disabled={completed}
                      onPress={() => void runCheckIn(booking.id)}
                    />
                  </View>
                </View>
              </View>
            );
          })}
          {!rows.length ? <Text style={styles.empty}>{t("noArrivals")}</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { minHeight: 122, backgroundColor: colors.accentDark, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { color: colors.white, fontSize: 20, fontWeight: "800" },
  heroMeta: { color: "#C7D2CB", fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  metrics: { flexDirection: "row", gap: spacing.sm },
  list: { gap: spacing.md },
  booking: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.blue, fontSize: 14, fontWeight: "800" },
  bookingCopy: { flex: 1, minWidth: 0 },
  bookingNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  bookingName: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
  course: { color: colors.text, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  time: { color: colors.muted, fontSize: 11, marginTop: 3 },
  action: { marginTop: spacing.md },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xxl }
});
