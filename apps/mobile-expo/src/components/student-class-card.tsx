import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  AvailabilitySession,
  LocalizedText,
  Participant
} from "@/api/types";
import { Pill, PrimaryButton } from "@/components/ui";
import { useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { reservationCount } from "@/utils/booking";

export function StudentClassCard({
  item,
  locale,
  featured = false,
  booking,
  disabled,
  pendingPayment,
  requiresPayment,
  onBook
}: {
  item: AvailabilitySession;
  locale: string;
  featured?: boolean;
  booking: boolean;
  disabled: boolean;
  pendingPayment: boolean;
  requiresPayment: boolean;
  onBook: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const booked = reservationCount(item);
  const remaining = Math.max(0, item.capacity - booked);
  const full = remaining === 0;

  return (
    <View style={[styles.classCard, featured && styles.classCardFeatured]}>
      <View style={styles.dateRail}>
        <Text selectable style={[styles.dateDay, featured && styles.lightText]}>
          {weekday(item.startsAt, locale)}
        </Text>
        <Text selectable style={[styles.dateNumber, featured && styles.lightText]}>
          {dayNumber(item.startsAt)}
        </Text>
      </View>
      <View style={styles.classBody}>
        {item.course?.imageUrl ? (
          <Image
            source={{ uri: item.course.imageUrl }}
            style={styles.courseImage}
            resizeMode="cover"
            accessibilityLabel={localizedText(item.course.title, locale, item.courseId)}
          />
        ) : null}
        <View style={styles.classTop}>
          <View style={styles.classCopy}>
            <Text selectable style={[styles.courseTitle, featured && styles.lightText]}>
              {localizedText(item.course?.title, locale, item.courseId)}
            </Text>
            <Text selectable style={[styles.courseMeta, featured && styles.lightMuted]}>
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
          <Text selectable style={[styles.joiningText, featured && styles.lightMuted]}>
            {booked} {t("joining")}
          </Text>
        </View>
        <PrimaryButton
          title={booking
            ? t("pleaseWait")
            : pendingPayment
              ? t("retryPayment")
              : full
                ? t("classFull")
                : requiresPayment
                  ? t("reserveAndPay")
                  : t("reserveClass")}
          onPress={() => void onBook()}
          disabled={disabled || (full && !pendingPayment)}
          icon={pendingPayment ? "card-outline" : full ? "close-circle-outline" : "arrow-forward"}
        />
      </View>
    </View>
  );
}

function AttendeeStrip({ session, featured }: { session: AvailabilitySession; featured: boolean }) {
  const styles = useThemedStyles(createStyles);
  const participants = (session.participants ?? []).slice(0, 6);
  const remaining = Math.max(0, (session.participantCount ?? participants.length) - participants.length);

  return (
    <View style={styles.attendeeStrip}>
      {participants.map((person, index) => (
        <Avatar key={person.bookingId} person={person} index={index} featured={featured} />
      ))}
      {remaining > 0 ? (
        <View style={[styles.avatar, styles.moreAvatar, { marginLeft: participants.length ? -8 : 0 }]}>
          <Text selectable style={styles.moreText}>+{remaining}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Avatar({ person, index, featured }: { person: Participant; index: number; featured: boolean }) {
  const styles = useThemedStyles(createStyles);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [person.avatarUrl]);

  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: person.color, marginLeft: index ? -8 : 0 },
        featured && styles.featuredAvatar
      ]}
    >
      <Text style={styles.avatarText}>{person.initials || "?"}</Text>
      {person.avatarUrl && !imageFailed ? (
        <Image
          source={{ uri: person.avatarUrl }}
          style={styles.participantAvatarImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </View>
  );
}

function weekday(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { weekday: "short" }).toUpperCase();
}

function dayNumber(value: string) {
  return new Date(value).getDate().toString().padStart(2, "0");
}

function timeRange(start: string, end: string, locale: string) {
  const options = { hour: "2-digit", minute: "2-digit" } as const;
  return `${new Date(start).toLocaleTimeString(locale, options)} – ${new Date(end).toLocaleTimeString(locale, options)}`;
}

function localizedText(
  value: string | LocalizedText | undefined,
  locale: string,
  fallback: string
) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  const localized = value as Record<string, string | undefined>;
  return localized[locale]
    ?? (locale === "zh-Hans" ? localized.zh : undefined)
    ?? localized.en
    ?? fallback;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    classCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.lg,
      borderCurve: "continuous",
      overflow: "hidden"
    },
    classCardFeatured: {
      backgroundColor: colors.accentDark,
      borderColor: colors.accentDark
    },
    dateRail: {
      width: 66,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: spacing.lg,
      borderRightWidth: 1,
      borderRightColor: colors.line
    },
    dateDay: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800"
    },
    dateNumber: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      fontVariant: ["tabular-nums"]
    },
    classBody: {
      flex: 1,
      gap: spacing.md,
      padding: spacing.md
    },
    courseImage: {
      width: "100%",
      height: 124,
      borderRadius: radius.md,
      borderCurve: "continuous",
      backgroundColor: colors.surfaceMuted
    },
    classTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: spacing.sm
    },
    classCopy: {
      flex: 1,
      gap: 4
    },
    courseTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800"
    },
    courseMeta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17
    },
    lightText: {
      color: colors.white
    },
    lightMuted: {
      color: colors.onAccentMuted
    },
    attendeeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm
    },
    attendeeStrip: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 34
    },
    avatar: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.surface,
      overflow: "hidden"
    },
    featuredAvatar: {
      borderColor: colors.accentDark
    },
    participantAvatarImage: {
      ...StyleSheet.absoluteFillObject,
      width: "100%",
      height: "100%"
    },
    avatarText: {
      color: colors.white,
      fontSize: 10,
      fontWeight: "900"
    },
    moreAvatar: {
      backgroundColor: colors.surfaceMuted
    },
    moreText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: "900",
      fontVariant: ["tabular-nums"]
    },
    joiningText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700"
    }
  });
}
