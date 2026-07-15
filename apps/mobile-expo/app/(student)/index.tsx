import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { getLocales } from "expo-localization";
import { useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  availability,
  bookings as listBookings,
  createBooking,
  createCheckoutSession,
  memberCards,
  order as getOrder,
  paymentMethods
} from "@/api/client";
import type { AvailabilitySession, LocalizedText, Order, Participant } from "@/api/types";
import { GhostButton, Loading, Metric, Pill, PrimaryButton, QueryErrorNotice, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import {
  apiErrorTranslationKey,
  localizedApiError
} from "@/utils/api-error";
import {
  pendingBookingsBySession,
  resolveCheckoutPaymentRegion,
  resolvePaymentRegion,
  selectEligibleMemberCard
} from "@/utils/booking";

export default function StudentScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const bookingRequestInFlight = useRef(false);
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);
  const deviceRegionCode = getLocales()[0]?.regionCode;
  const paymentRegion = resolvePaymentRegion(deviceRegionCode);
  const { colors, styles } = useStudentTheme();
  const classes = useQuery({
    queryKey: ["availability", session.locale],
    queryFn: () => availability(session.locale),
    enabled: Boolean(session.token)
  });
  const cards = useQuery({ queryKey: ["member-cards"], queryFn: memberCards, enabled: Boolean(session.token) });
  const bookingHistory = useQuery({
    queryKey: ["bookings", "student", session.locale],
    queryFn: () => listBookings(session.locale),
    enabled: Boolean(session.token)
  });
  const methods = useQuery({
    queryKey: ["payment-methods", paymentRegion.country, paymentRegion.currency],
    queryFn: () => paymentMethods(paymentRegion.country, paymentRegion.currency),
    enabled: Boolean(session.token)
  });

  if (classes.isLoading || cards.isLoading || bookingHistory.isLoading) return <Loading />;
  if (classes.error || cards.error || bookingHistory.error) {
    return (
      <Screen title={t("student")} eyebrow={t("studentStudio")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <QueryErrorNotice
            title={t("studentDataErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void Promise.all([classes.refetch(), cards.refetch(), bookingHistory.refetch()])}
          />
        </ScrollView>
      </Screen>
    );
  }

  const activeCard = selectEligibleMemberCard(cards.data ?? []);
  const nextClass = classes.data?.[0];
  const availableClasses = classes.data ?? [];
  const pendingBookings = pendingBookingsBySession(bookingHistory.data ?? []);

  async function launchCheckout(orderData: Order) {
    const checkoutRegion = resolveCheckoutPaymentRegion(deviceRegionCode, orderData.currency);
    const eligibleMethods = checkoutRegion.country === paymentRegion.country
      && checkoutRegion.currency === paymentRegion.currency
      && methods.data?.length
      ? methods.data
      : await paymentMethods(checkoutRegion.country, checkoutRegion.currency);
    const methodCode = eligibleMethods.find((method) => method.code === "card")?.code
      ?? eligibleMethods[0]?.code;
    if (!methodCode) throw new Error(t("checkoutUnavailable"));

    const checkout = await createCheckoutSession({
      orderId: orderData.id,
      country: checkoutRegion.country,
      currency: checkoutRegion.currency,
      methodCode,
      locale: session.locale
    });
    const checkoutUrl = checkout.stripe.url;
    if (!checkoutUrl || !(await Linking.canOpenURL(checkoutUrl))) {
      throw new Error(t("checkoutUnavailable"));
    }
    await Linking.openURL(checkoutUrl);
  }

  async function bookClass(courseSession: AvailabilitySession) {
    if (bookingRequestInFlight.current) return;

    bookingRequestInFlight.current = true;
    setBookingClassId(courseSession.id);
    let pendingPaymentReference: string | null = null;
    try {
      let bookingRows = bookingHistory.data;
      if (!bookingRows) {
        const refreshed = await bookingHistory.refetch();
        bookingRows = refreshed.data;
      }
      if (!bookingRows) throw new Error(t("unableToLoadBookings"));

      const existingPendingBooking = bookingRows.find((booking) => (
        booking.courseSessionId === courseSession.id && booking.status === "pending_payment"
      ));
      if (existingPendingBooking) {
        pendingPaymentReference = existingPendingBooking.orderId ?? existingPendingBooking.id;
        if (!existingPendingBooking.orderId) throw new Error(t("checkoutUnavailable"));
        const pendingOrder = await getOrder(existingPendingBooking.orderId);
        await launchCheckout(pendingOrder);
        return;
      }

      const requiredCredits = courseSession.course?.memberCardDeductCount ?? 1;
      const eligibleCard = selectEligibleMemberCard(cards.data ?? [], requiredCredits);
      const result = await createBooking(courseSession.id, eligibleCard ? "member_card" : "payment");

      if (eligibleCard) {
        Alert.alert(t("reserved"), t("reservationConfirmed"));
      } else {
        pendingPaymentReference = result.order?.id ?? result.booking.id;
        if (!result.order?.id) throw new Error(t("checkoutUnavailable"));
        await launchCheckout(result.order);
      }
    } catch (error) {
      const detail = studentErrorMessage(error, t);
      if (pendingPaymentReference && apiErrorTranslationKey(error) !== "paymentUnavailable") {
        Alert.alert(
          t("paymentPending"),
          `${t("paymentPendingMessage", { orderId: pendingPaymentReference })}\n\n${detail}`
        );
      } else {
        Alert.alert(t("unableToBook"), detail);
      }
    } finally {
      await Promise.allSettled([classes.refetch(), cards.refetch(), bookingHistory.refetch()]);
      bookingRequestInFlight.current = false;
      setBookingClassId(null);
    }
  }

  return (
    <Screen title={t("student")} eyebrow={t("studentStudio")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.welcome}>
          <View>
            <Text style={styles.greeting}>{t("goodMorning")},</Text>
            <Text style={styles.name}>{session.user?.name ?? "Yogi"}</Text>
          </View>
          <View style={styles.streak}>
            <Ionicons name="flame-outline" size={18} color={colors.coral} />
            <Text style={styles.streakText}>{t("weekStreak")}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <Metric label={t("creditsLeft")} value={activeCard?.remainingCredits ?? 0} icon="ticket-outline" />
          <Metric label={t("availableClasses")} value={availableClasses.length} icon="calendar-outline" tone="blue" />
          <Metric label={t("booked")} value={nextClass?.participantCount ?? 0} icon="people-outline" tone="coral" />
        </View>

        {activeCard ? (
          <View style={styles.membership}>
            <View style={styles.membershipTop}>
              <View>
                <Text style={styles.membershipEyebrow}>{t("brandMembership")}</Text>
                <Text style={styles.membershipTitle}>{t("studioPass")}</Text>
              </View>
              <Pill label={t("statusActive")} tone="sage" />
            </View>
            <View style={styles.creditTrack}>
              <View
                style={[
                  styles.creditFill,
                  { width: `${creditPercentage(activeCard.remainingCredits, activeCard.totalCredits)}%` }
                ]}
              />
            </View>
            <View style={styles.membershipBottom}>
              <Text style={styles.membershipMeta}>{activeCard.remainingCredits}/{activeCard.totalCredits} {t("sessions")}</Text>
              <Text style={styles.membershipMeta}>{t("validUntil")} {shortDate(activeCard.expiresAt, session.locale)}</Text>
            </View>
          </View>
        ) : null}

        <SectionHeader title={t("upcomingClasses")} meta={t("classSocialMeta")} />
        <View style={styles.classList}>
          {availableClasses.map((item, index) => {
            const pendingBooking = pendingBookings.get(item.id);
            return (
              <ClassCard
                key={item.id}
                item={item}
                locale={session.locale}
                featured={index === 0}
                booking={bookingClassId === item.id}
                disabled={bookingClassId !== null}
                pendingPayment={Boolean(pendingBooking)}
                requiresPayment={Boolean(pendingBooking) || !selectEligibleMemberCard(cards.data ?? [], item.course?.memberCardDeductCount ?? 1)}
                onBook={() => bookClass(item)}
              />
            );
          })}
        </View>

        <SectionHeader
          title={t("paymentMethods")}
          meta={t("paymentRegion", paymentRegion)}
        />
        {methods.error ? (
          <QueryErrorNotice
            title={t("paymentMethodsErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void methods.refetch()}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodList}>
            {(methods.data ?? []).map((method) => (
              <View key={method.code} style={styles.method}>
                <Ionicons name={paymentIcon(method.family)} size={20} color={colors.blue} />
                <Text style={styles.methodName}>
                  {method.display?.[session.locale === "zh-Hans" ? "zh" : session.locale] ?? method.display?.en ?? method.code}
                </Text>
                <Text style={styles.methodCode}>{method.code}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </Screen>
  );
}

function studentErrorMessage(error: unknown, t: (key: string) => string) {
  if (
    error instanceof Error
    && [t("checkoutUnavailable"), t("unableToLoadBookings")].includes(error.message)
  ) {
    return error.message;
  }
  return localizedApiError(error, t);
}

function ClassCard({
  item,
  locale,
  featured,
  booking,
  disabled,
  pendingPayment,
  requiresPayment,
  onBook
}: {
  item: AvailabilitySession;
  locale: string;
  featured: boolean;
  booking: boolean;
  disabled: boolean;
  pendingPayment: boolean;
  requiresPayment: boolean;
  onBook: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { styles } = useStudentTheme();
  const booked = item.participantCount ?? item.participants?.length ?? item.bookedCount;
  const remaining = Math.max(0, item.capacity - booked);
  const full = remaining === 0;

  return (
    <View style={[styles.classCard, featured && styles.classCardFeatured]}>
      <View style={styles.dateRail}>
        <Text style={[styles.dateDay, featured && styles.lightText]}>{weekday(item.startsAt, locale)}</Text>
        <Text style={[styles.dateNumber, featured && styles.lightText]}>{dayNumber(item.startsAt)}</Text>
      </View>
      <View style={styles.classBody}>
        <View style={styles.classTop}>
          <View style={styles.classCopy}>
            <Text style={[styles.courseTitle, featured && styles.lightText]}>
              {localizedText(item.course?.title, locale, item.courseId)}
            </Text>
            <Text style={[styles.courseMeta, featured && styles.lightMuted]}>
              {timeRange(item.startsAt, item.endsAt, locale)} · {item.coach?.name ?? item.coachId}
            </Text>
          </View>
          <Pill
            label={pendingPayment ? t("statusPendingPayment") : full ? t("classFull") : `${remaining} ${t("left")}`}
            tone={pendingPayment ? "blue" : remaining <= 2 ? "coral" : "sage"}
          />
        </View>
        <View style={styles.attendeeRow}>
          <AttendeeStrip session={item} featured={featured} />
          <Text style={[styles.joiningText, featured && styles.lightMuted]}>{booked} {t("joining")}</Text>
        </View>
        <PrimaryButton
          title={booking ? t("pleaseWait") : pendingPayment ? t("retryPayment") : full ? t("classFull") : requiresPayment ? t("reserveAndPay") : t("reserveClass")}
          onPress={() => void onBook()}
          disabled={disabled || (full && !pendingPayment)}
          icon={pendingPayment ? "card-outline" : full ? "close-circle-outline" : "arrow-forward"}
        />
      </View>
    </View>
  );
}

function AttendeeStrip({ session, featured }: { session: AvailabilitySession; featured: boolean }) {
  const { styles } = useStudentTheme();
  const participants = (session.participants ?? []).slice(0, 6);
  const remaining = Math.max(0, (session.participantCount ?? participants.length) - participants.length);
  return (
    <View style={styles.attendeeStrip}>
      {participants.map((person, index) => <Avatar key={person.bookingId} person={person} index={index} featured={featured} />)}
      {remaining > 0 ? (
        <View style={[styles.avatar, styles.moreAvatar, { marginLeft: participants.length ? -8 : 0 }]}>
          <Text style={styles.moreText}>+{remaining}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Avatar({ person, index, featured }: { person: Participant; index: number; featured: boolean }) {
  const { colors, styles } = useStudentTheme();

  return (
    <View style={[
      styles.avatar,
      { backgroundColor: person.color || colors.accent, marginLeft: index ? -8 : 0 },
      featured && styles.featuredAvatar
    ]}>
      <Text style={styles.avatarText}>{person.initials || "?"}</Text>
    </View>
  );
}

function paymentIcon(family: string): "card-outline" | "wallet-outline" {
  return family === "card" ? "card-outline" : "wallet-outline";
}

function weekday(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { weekday: "short" }).toUpperCase();
}

function dayNumber(value: string) {
  return new Date(value).getDate().toString().padStart(2, "0");
}

function shortDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function timeRange(start: string, end: string, locale: string) {
  const options = { hour: "2-digit", minute: "2-digit" } as const;
  return `${new Date(start).toLocaleTimeString(locale, options)} – ${new Date(end).toLocaleTimeString(locale, options)}`;
}

function creditPercentage(remaining: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
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

function useStudentTheme() {
  const { colors } = useTheme();
  return { colors, styles: useThemedStyles(createStyles) };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  welcome: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.md },
  greeting: { color: colors.muted, fontSize: 14 },
  name: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 2 },
  streak: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.coralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  streakText: { color: colors.coral, fontSize: 11, fontWeight: "800" },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  membership: { backgroundColor: colors.black, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg },
  membershipTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  membershipEyebrow: { color: colors.onDarkSubtle, fontSize: 10, fontWeight: "800" },
  membershipTitle: { color: colors.white, fontSize: 23, fontWeight: "800", marginTop: spacing.xs },
  creditTrack: { height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: colors.progressTrack },
  creditFill: { height: "100%", backgroundColor: colors.coral, borderRadius: 999 },
  membershipBottom: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  membershipMeta: { color: colors.onDarkMuted, fontSize: 11 },
  classList: { gap: spacing.md },
  classCard: { flexDirection: "row", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" },
  classCardFeatured: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  dateRail: { width: 68, paddingVertical: spacing.lg, alignItems: "center", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  dateDay: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  dateNumber: { color: colors.text, fontSize: 28, fontWeight: "800", marginTop: spacing.xs },
  classBody: { flex: 1, minWidth: 0, padding: spacing.lg, gap: spacing.lg },
  classTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  classCopy: { flex: 1, minWidth: 0 },
  courseTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  courseMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  lightText: { color: colors.white },
  lightMuted: { color: colors.onAccentMuted },
  attendeeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  attendeeStrip: { flexDirection: "row", alignItems: "center", minHeight: 34 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  featuredAvatar: { borderColor: colors.accentDark },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  moreAvatar: { backgroundColor: colors.coral },
  moreText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  joiningText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  methodList: { gap: spacing.sm },
  method: { width: 142, minHeight: 112, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, justifyContent: "space-between" },
  methodName: { color: colors.text, fontWeight: "800", fontSize: 13 },
  methodCode: { color: colors.muted, fontSize: 10, textTransform: "uppercase" }
  });
}
