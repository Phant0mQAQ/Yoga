import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { bookings, checkIn } from "@/api/client";
import type { Booking, LocalizedText } from "@/api/types";
import { GhostButton, Loading, Metric, Pill, PrimaryButton, QueryErrorNotice, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { parseBookingIdFromQr } from "@/utils/booking";
import { localizedApiError } from "@/utils/api-error";

export default function StaffScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const checkInRequestInFlight = useRef(false);
  const scannerScanLocked = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const query = useQuery({
    queryKey: ["staff-bookings", session.locale],
    queryFn: () => bookings(session.locale),
    enabled: Boolean(session.token)
  });

  if (query.isLoading) return <Loading />;
  if (query.error) {
    return (
      <Screen title={t("staff")} eyebrow={t("frontDesk")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <QueryErrorNotice
            title={t("staffDataErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void query.refetch()}
          />
        </ScrollView>
      </Screen>
    );
  }

  const rows = query.data ?? [];
  const pending = rows.filter((booking) => booking.status === "confirmed").length;
  const arrived = rows.filter((booking) => booking.status === "checked_in").length;

  async function openScanner() {
    if (checkInRequestInFlight.current) return;
    try {
      const permission = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert(t("cameraPermissionTitle"), t("cameraPermissionMessage"));
        return;
      }
      scannerScanLocked.current = false;
      setScannerVisible(true);
    } catch (error) {
      Alert.alert(
        t("cameraUnavailableTitle"),
        localizedApiError(error, t)
      );
    }
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scannerScanLocked.current || checkInRequestInFlight.current) return;
    scannerScanLocked.current = true;
    setScannerVisible(false);

    const bookingId = parseBookingIdFromQr(result.data);
    if (!bookingId) {
      Alert.alert(t("invalidBookingQrTitle"), t("invalidBookingQrMessage"));
      return;
    }
    void runCheckIn(bookingId, "qr");
  }

  async function runCheckIn(bookingId: string, method: "manual" | "qr" = "manual") {
    if (checkInRequestInFlight.current) return;
    checkInRequestInFlight.current = true;
    scannerScanLocked.current = true;
    setScannerVisible(false);
    setCheckingInId(bookingId);
    try {
      await checkIn(bookingId, method);
      Alert.alert(t("checkInSuccessTitle"), t("checkInSuccessMessage"));
      await query.refetch();
    } catch (error) {
      Alert.alert(t("checkInFailedTitle"), localizedApiError(error, t));
    } finally {
      checkInRequestInFlight.current = false;
      setCheckingInId(null);
    }
  }

  return (
    <Screen title={t("staff")} eyebrow={t("frontDesk")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("scanBookingQr")}
          disabled={checkingInId !== null}
          onPress={() => scannerVisible ? setScannerVisible(false) : void openScanner()}
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="scan-outline" size={28} color={colors.white} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t("readyForArrivals")}</Text>
            <Text style={styles.heroMeta}>{t("arrivalsMeta")}</Text>
          </View>
          <Ionicons name={scannerVisible ? "chevron-up" : "chevron-forward"} size={20} color={colors.scannerMuted} />
        </Pressable>

        {scannerVisible && cameraPermission?.granted ? (
          <View style={styles.scannerCard}>
            <View style={styles.cameraFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View pointerEvents="none" style={styles.scanOverlay}>
                <View style={styles.scanTarget} />
                <Text style={styles.scanHint}>{t("alignBookingQr")}</Text>
              </View>
            </View>
            <GhostButton
              title={t("closeScanner")}
              icon="close"
              onPress={() => setScannerVisible(false)}
            />
          </View>
        ) : null}

        <View style={styles.metrics}>
          <Metric label={t("todayList")} value={rows.length} icon="list-outline" />
          <Metric label={t("waiting")} value={pending} icon="time-outline" tone="coral" />
          <Metric label={t("arrived")} value={arrived} icon="checkmark-done-outline" tone="blue" />
        </View>

        <SectionHeader title={t("arrivalList")} meta={t("arrivalListMeta")} />
        <View style={styles.list}>
          {rows.map((booking) => {
            const completed = booking.status === "checked_in";
            const cancelled = booking.status === "cancelled";
            const pendingPayment = booking.status === "pending_payment";
            const checkInEligible = booking.status === "confirmed";
            return (
              <View key={booking.id} style={styles.booking}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(booking.user?.name ?? booking.userId)}</Text>
                </View>
                <View style={styles.bookingCopy}>
                  <View style={styles.bookingNameRow}>
                    <Text style={styles.bookingName}>{booking.user?.name ?? booking.userId}</Text>
                    <Pill label={t(bookingStatusKey(booking.status))} tone={bookingStatusTone(booking.status)} />
                  </View>
                  <Text style={styles.course}>{localizedText(booking.course?.title, session.locale, booking.courseId)}</Text>
                  <Text style={styles.time}>{new Date(booking.startsAt).toLocaleString(session.locale)}</Text>
                  <View style={styles.action}>
                    <PrimaryButton
                      title={completed
                        ? t("checkedIn")
                        : cancelled
                          ? t("cancelled")
                          : pendingPayment
                            ? t("statusPendingPayment")
                            : checkingInId === booking.id
                              ? t("pleaseWait")
                              : t("manualCheckIn")}
                      icon={completed ? "checkmark" : cancelled ? "close" : pendingPayment ? "card-outline" : "enter-outline"}
                      disabled={!checkInEligible || checkingInId !== null}
                      onPress={() => void runCheckIn(booking.id, "manual")}
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

function bookingStatusKey(status: Booking["status"]) {
  if (status === "pending_payment") return "statusPendingPayment" as const;
  if (status === "confirmed") return "statusConfirmed" as const;
  if (status === "cancelled") return "statusCancelled" as const;
  return "statusCheckedIn" as const;
}

function bookingStatusTone(status: Booking["status"]): "sage" | "coral" | "blue" | "neutral" {
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
  hero: { minHeight: 122, backgroundColor: colors.accentDark, borderRadius: radius.lg, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroPressed: { opacity: 0.78 },
  heroIcon: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { color: colors.white, fontSize: 20, fontWeight: "800" },
  heroMeta: { color: colors.scannerMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  scannerCard: { gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm },
  cameraFrame: { height: 320, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.black },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: "rgba(0,0,0,0.12)" },
  scanTarget: { width: 210, height: 210, borderWidth: 3, borderColor: colors.white, borderRadius: radius.lg, backgroundColor: "transparent" },
  scanHint: { color: colors.white, fontSize: 13, fontWeight: "800", backgroundColor: "rgba(0,0,0,0.58)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
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
}
