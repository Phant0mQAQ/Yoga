import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { availability, createBooking, memberCards, paymentMethods } from "@/api/client";
import type { AvailabilitySession, Participant } from "@/api/types";
import { GhostButton, Loading, Metric, Pill, PrimaryButton, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { colors, radius, spacing } from "@/theme/tokens";

export default function StudentScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const classes = useQuery({
    queryKey: ["availability", session.locale],
    queryFn: () => availability(session.locale),
    enabled: Boolean(session.token)
  });
  const cards = useQuery({ queryKey: ["member-cards"], queryFn: memberCards, enabled: Boolean(session.token) });
  const methods = useQuery({
    queryKey: ["payment-methods", session.locale],
    queryFn: () => paymentMethods(session.locale === "ko" ? "KR" : "HK", session.locale === "ko" ? "KRW" : "HKD"),
    enabled: Boolean(session.token)
  });

  if (classes.isLoading || cards.isLoading) return <Loading />;

  const activeCard = cards.data?.[0];
  const nextClass = classes.data?.[0];
  const availableClasses = classes.data ?? [];

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
                <Text style={styles.membershipEyebrow}>{t("yomiMembership")}</Text>
                <Text style={styles.membershipTitle}>{t("studioPass")}</Text>
              </View>
              <Pill label={activeCard.status} tone="sage" />
            </View>
            <View style={styles.creditTrack}>
              <View
                style={[
                  styles.creditFill,
                  { width: `${Math.max(0, Math.min(100, (activeCard.remainingCredits / activeCard.totalCredits) * 100))}%` }
                ]}
              />
            </View>
            <View style={styles.membershipBottom}>
              <Text style={styles.membershipMeta}>{activeCard.remainingCredits}/{activeCard.totalCredits} {t("sessions")}</Text>
              <Text style={styles.membershipMeta}>{t("validUntil")} {shortDate(activeCard.expiresAt)}</Text>
            </View>
          </View>
        ) : null}

        <SectionHeader title={t("upcomingClasses")} meta={t("classSocialMeta")} />
        <View style={styles.classList}>
          {availableClasses.map((item, index) => (
            <ClassCard
              key={item.id}
              item={item}
              featured={index === 0}
              onBook={async () => {
                try {
                  await createBooking(item.id, "member_card");
                  Alert.alert(t("reserved"), t("reservationConfirmed"));
                  await Promise.all([classes.refetch(), cards.refetch()]);
                } catch (error) {
                  Alert.alert(t("unableToBook"), error instanceof Error ? error.message : "Request failed");
                }
              }}
            />
          ))}
        </View>

        <SectionHeader title={t("paymentMethods")} meta={t("paymentRegion")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodList}>
          {(methods.data ?? []).map((method) => (
            <View key={method.code} style={styles.method}>
              <Ionicons name={paymentIcon(method.family)} size={20} color={colors.blue} />
              <Text style={styles.methodName}>{method.display?.[session.locale] ?? method.display?.en ?? method.code}</Text>
              <Text style={styles.methodCode}>{method.code}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}

function ClassCard({
  item,
  featured,
  onBook
}: {
  item: AvailabilitySession;
  featured: boolean;
  onBook: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const booked = item.participantCount ?? item.participants?.length ?? item.bookedCount;
  const remaining = Math.max(0, item.capacity - booked);

  return (
    <View style={[styles.classCard, featured && styles.classCardFeatured]}>
      <View style={styles.dateRail}>
        <Text style={[styles.dateDay, featured && styles.lightText]}>{weekday(item.startsAt)}</Text>
        <Text style={[styles.dateNumber, featured && styles.lightText]}>{dayNumber(item.startsAt)}</Text>
      </View>
      <View style={styles.classBody}>
        <View style={styles.classTop}>
          <View style={styles.classCopy}>
            <Text style={[styles.courseTitle, featured && styles.lightText]}>
              {String(item.course?.title ?? item.courseId)}
            </Text>
            <Text style={[styles.courseMeta, featured && styles.lightMuted]}>
              {timeRange(item.startsAt, item.endsAt)} · {item.coach?.name ?? item.coachId}
            </Text>
          </View>
          <Pill label={remaining === 0 ? t("waitlist") : `${remaining} ${t("left")}`} tone={remaining <= 2 ? "coral" : "sage"} />
        </View>
        <View style={styles.attendeeRow}>
          <AttendeeStrip session={item} featured={featured} />
          <Text style={[styles.joiningText, featured && styles.lightMuted]}>{booked} {t("joining")}</Text>
        </View>
        <PrimaryButton title={remaining === 0 ? t("joinWaitlist") : t("reserveClass")} onPress={() => void onBook()} icon="arrow-forward" />
      </View>
    </View>
  );
}

function AttendeeStrip({ session, featured }: { session: AvailabilitySession; featured: boolean }) {
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

function weekday(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: "short" }).toUpperCase();
}

function dayNumber(value: string) {
  return new Date(value).getDate().toString().padStart(2, "0");
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeRange(start: string, end: string) {
  const options = { hour: "2-digit", minute: "2-digit" } as const;
  return `${new Date(start).toLocaleTimeString([], options)} – ${new Date(end).toLocaleTimeString([], options)}`;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  welcome: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.md },
  greeting: { color: colors.muted, fontSize: 14 },
  name: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 2 },
  streak: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.coralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  streakText: { color: colors.coral, fontSize: 11, fontWeight: "800" },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  membership: { backgroundColor: colors.black, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg },
  membershipTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  membershipEyebrow: { color: "#AAB8AF", fontSize: 10, fontWeight: "800" },
  membershipTitle: { color: colors.white, fontSize: 23, fontWeight: "800", marginTop: spacing.xs },
  creditTrack: { height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: "#3A403D" },
  creditFill: { height: "100%", backgroundColor: colors.coral, borderRadius: 999 },
  membershipBottom: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  membershipMeta: { color: "#C8CECA", fontSize: 11 },
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
  lightMuted: { color: "#C5D0C9" },
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
