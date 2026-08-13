import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { getLocales } from "expo-localization";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  availability,
  bookings as listBookings,
  createBooking,
  createCheckoutSession,
  home,
  memberCards,
  order as getOrder,
  paymentMethods,
  presignAvatarUpload,
  saveAvatar,
  uploadAvatarFile
} from "@/api/client";
import type {
  AvailabilitySession,
  ContentBlock,
  LocalizedText,
  Order,
  Participant,
  Product
} from "@/api/types";
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
  countUpcomingBookings,
  isSessionBookable,
  pendingBookingsBySession,
  reservationCount,
  resolveCheckoutPaymentRegion,
  selectEligibleMemberCard
} from "@/utils/booking";

export default function StudentScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const bookingRequestInFlight = useRef(false);
  const avatarUploadInFlight = useRef(false);
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const deviceRegionCode = getLocales()[0]?.regionCode;
  const { colors, styles } = useStudentTheme();
  const classes = useQuery({
    queryKey: ["availability", session.locale],
    queryFn: () => availability(session.locale),
    enabled: Boolean(session.token),
    refetchInterval: 30_000
  });
  const studio = useQuery({
    queryKey: ["home", session.locale],
    queryFn: () => home(session.locale),
    enabled: Boolean(session.token),
    refetchInterval: 60_000
  });
  const cards = useQuery({ queryKey: ["member-cards"], queryFn: memberCards, enabled: Boolean(session.token) });
  const bookingHistory = useQuery({
    queryKey: ["bookings", "student", session.locale],
    queryFn: () => listBookings(session.locale),
    enabled: Boolean(session.token),
    refetchInterval: 30_000
  });

  function refreshAll() {
    return Promise.all([
      classes.refetch(),
      studio.refetch(),
      cards.refetch(),
      bookingHistory.refetch()
    ]);
  }

  if (classes.isLoading || studio.isLoading || cards.isLoading || bookingHistory.isLoading) return <Loading />;
  if (classes.error || studio.error || cards.error || bookingHistory.error) {
    return (
      <Screen title={t("student")} eyebrow={t("studentStudio")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <QueryErrorNotice
            title={t("studentDataErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void refreshAll()}
          />
        </ScrollView>
      </Screen>
    );
  }

  const activeCard = selectEligibleMemberCard(cards.data ?? []);
  const availableClasses = classes.data ?? [];
  const bookableClasses = availableClasses.filter((item) => isSessionBookable(item));
  const bookableClassCount = bookableClasses.length;
  const upcomingBookingCount = countUpcomingBookings(bookingHistory.data ?? []);
  const pendingBookings = pendingBookingsBySession(bookingHistory.data ?? []);
  const studioContent = [
    ...(studio.data?.banners ?? []),
    ...(studio.data?.features ?? []),
    ...(studio.data?.knowledge ?? [])
  ];
  const refreshing = classes.isRefetching
    || studio.isRefetching
    || cards.isRefetching
    || bookingHistory.isRefetching;

  async function launchCheckout(orderData: Order) {
    const checkoutRegion = resolveCheckoutPaymentRegion(deviceRegionCode, orderData.currency);
    const eligibleMethods = await paymentMethods(checkoutRegion.country, checkoutRegion.currency);
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

  async function chooseAvatar() {
    if (avatarUploadInFlight.current) return;
    avatarUploadInFlight.current = true;
    setAvatarUploading(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("photoPermissionTitle"), t("photoPermissionMessage"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "image/jpeg";
      const fileName = asset.fileName ?? `avatar-${Date.now()}.${extensionForMimeType(contentType)}`;
      if (asset.fileSize && asset.fileSize > 10_000_000) throw new Error(t("avatarTooLarge"));
      setAvatarPreviewUri(asset.uri);

      const upload = await presignAvatarUpload({ fileName, contentType, fileSize: asset.fileSize });
      const localResponse = await fetch(asset.uri);
      if (!localResponse.ok) throw new Error(t("unableToReadImage"));
      await uploadAvatarFile(upload, contentType, await localResponse.blob());

      await saveAvatar(upload.objectKey);
      await session.refreshUser();
      setAvatarPreviewUri(null);
      await bookingHistory.refetch();
      Alert.alert(t("avatarUpdatedTitle"), t("avatarUpdatedMessage"));
    } catch (error) {
      setAvatarPreviewUri(null);
      Alert.alert(t("uploadFailedTitle"), avatarErrorMessage(error, t));
    } finally {
      avatarUploadInFlight.current = false;
      setAvatarUploading(false);
    }
  }

  return (
    <Screen title={t("student")} eyebrow={t("studentStudio")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcome}>
          <View style={styles.identityCopy}>
            <Text style={styles.greeting}>{t("goodMorning")},</Text>
            <Text style={styles.name}>{session.user?.name ?? "Yogi"}</Text>
            <View style={styles.streak}>
              <Ionicons name="flame-outline" size={18} color={colors.coral} />
              <Text style={styles.streakText}>{t("weekStreak")}</Text>
            </View>
          </View>
          <ProfilePhotoButton
            uri={avatarPreviewUri ?? session.user?.avatarUrl ?? null}
            name={session.user?.name ?? "Yogi"}
            uploading={avatarUploading}
            onPress={() => void chooseAvatar()}
          />
        </View>

        <View style={styles.metricRow}>
          <Metric label={t("creditsLeft")} value={activeCard?.remainingCredits ?? 0} icon="ticket-outline" />
          <Metric label={t("availableClasses")} value={bookableClassCount} icon="calendar-outline" tone="blue" />
          <Metric label={t("booked")} value={upcomingBookingCount} icon="people-outline" tone="coral" />
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
          {bookableClasses.length ? bookableClasses.slice(0, 3).map((item, index) => {
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
          }) : <Text style={styles.emptyText}>{t("noScheduledClasses")}</Text>}
        </View>

        {studioContent.length ? (
          <>
            <SectionHeader title={t("studioUpdates")} meta={t("studioUpdatesMeta")} />
            <View style={styles.editorialList}>
              {studioContent.map((block) => (
                <ContentCard key={block.id} block={block} locale={session.locale} />
              ))}
            </View>
          </>
        ) : null}

        {(studio.data?.storeRecommendations.length ?? 0) > 0 ? (
          <>
            <SectionHeader title={t("studioShop")} meta={t("studioShopMeta")} />
            <View style={styles.catalogGrid}>
              {studio.data?.storeRecommendations.map((product) => (
                <ProductCard key={product.id} product={product} locale={session.locale} />
              ))}
            </View>
          </>
        ) : null}
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

function ContentCard({
  block,
  locale
}: {
  block: ContentBlock;
  locale: string;
}) {
  const { styles } = useStudentTheme();
  return (
    <View style={styles.editorialCard}>
      {block.imageUrl ? (
        <Image
          source={{ uri: block.imageUrl }}
          style={styles.editorialImage}
          resizeMode="cover"
          accessibilityLabel={localizedText(block.title, locale, block.id)}
        />
      ) : null}
      <View style={styles.editorialBody}>
        <Text style={styles.editorialType}>{block.type.toUpperCase()}</Text>
        <Text style={styles.editorialTitle}>{localizedText(block.title, locale, block.id)}</Text>
        <Text style={styles.editorialDescription}>
          {localizedText(block.description, locale, "")}
        </Text>
      </View>
    </View>
  );
}

function ProductCard({ product, locale }: { product: Product; locale: string }) {
  const { t } = useTranslation();
  const { styles } = useStudentTheme();
  return (
    <View style={styles.catalogCard}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.catalogImage}
          resizeMode="cover"
          accessibilityLabel={localizedText(product.title, locale, product.id)}
        />
      ) : (
        <View style={styles.catalogPlaceholder}>
          <Ionicons name="bag-handle-outline" size={28} style={styles.catalogPlaceholderIcon} />
        </View>
      )}
      <View style={styles.catalogBody}>
        <Text style={styles.catalogTitle}>{localizedText(product.title, locale, product.id)}</Text>
        <Text style={styles.catalogDescription}>{localizedText(product.description, locale, "")}</Text>
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>{formatAmount(product.priceAmount, product.currency, locale)}</Text>
          <Pill label={t("stockCount", { count: product.stock })} tone={product.stock > 0 ? "sage" : "neutral"} />
        </View>
      </View>
    </View>
  );
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
  const booked = reservationCount(item);
  const remaining = Math.max(0, item.capacity - booked);
  const full = remaining === 0;

  return (
    <View style={[styles.classCard, featured && styles.classCardFeatured]}>
      <View style={styles.dateRail}>
        <Text style={[styles.dateDay, featured && styles.lightText]}>{weekday(item.startsAt, locale)}</Text>
        <Text style={[styles.dateNumber, featured && styles.lightText]}>{dayNumber(item.startsAt)}</Text>
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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [person.avatarUrl]);

  return (
    <View style={[
      styles.avatar,
      { backgroundColor: person.color || colors.accent, marginLeft: index ? -8 : 0 },
      featured && styles.featuredAvatar
    ]}>
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

function ProfilePhotoButton({
  uri,
  name,
  uploading,
  onPress
}: {
  uri: string | null;
  name: string;
  uploading: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useStudentTheme();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [uri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("profilePhotoAccessibility")}
      disabled={uploading}
      onPress={onPress}
      style={({ pressed }) => [styles.profilePhotoButton, (pressed || uploading) && styles.profilePhotoPressed]}
    >
      <View style={styles.profilePhoto}>
        <Text style={styles.profilePhotoInitials}>{initialsFor(name)}</Text>
        {uri && !imageFailed ? (
          <Image
            key={uri}
            source={{ uri }}
            style={styles.profilePhotoImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
        <View style={styles.cameraBadge}>
          <Ionicons name={uploading ? "hourglass-outline" : "camera-outline"} size={14} color={colors.white} />
        </View>
      </View>
      <Text style={styles.changePhotoText}>{t(uploading ? "uploadingAvatar" : "changeProfilePhoto")}</Text>
    </Pressable>
  );
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

function avatarErrorMessage(error: unknown, t: (key: string, options?: Record<string, unknown>) => string) {
  if (error instanceof Error && [t("unableToReadImage"), t("avatarTooLarge")].includes(error.message)) {
    return error.message;
  }
  return localizedApiError(error, t);
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

function formatAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
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
  welcome: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  identityCopy: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: spacing.xs },
  greeting: { color: colors.muted, fontSize: 14 },
  name: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 2 },
  streak: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.coralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  streakText: { color: colors.coral, fontSize: 11, fontWeight: "800" },
  profilePhotoButton: { width: 96, alignItems: "center", gap: spacing.xs },
  profilePhotoPressed: { opacity: 0.65 },
  profilePhoto: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentDark, borderWidth: 3, borderColor: colors.surface, alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)" },
  profilePhotoImage: { position: "absolute", top: 0, left: 0, width: 70, height: 70, borderRadius: 35 },
  profilePhotoInitials: { color: colors.white, fontSize: 22, fontWeight: "800" },
  cameraBadge: { position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.coral, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  changePhotoText: { color: colors.accent, fontSize: 11, lineHeight: 15, fontWeight: "800", textAlign: "center" },
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
  courseImage: { width: "100%", height: 148, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
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
  participantAvatarImage: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  moreAvatar: { backgroundColor: colors.coral },
  moreText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  joiningText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, padding: spacing.lg, textAlign: "center" },
  catalogGrid: { gap: spacing.md },
  catalogCard: { overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderCurve: "continuous" },
  catalogImage: { width: "100%", height: 168, backgroundColor: colors.surfaceMuted },
  catalogPlaceholder: { height: 112, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft },
  catalogPlaceholderIcon: { color: colors.accentDark },
  catalogBody: { padding: spacing.lg, gap: spacing.sm },
  catalogTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  catalogDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  catalogMeta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  catalogSchedule: { color: colors.accentDark, fontSize: 12, lineHeight: 18, fontWeight: "800" },
  editorialList: { gap: spacing.md },
  editorialCard: { overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderCurve: "continuous" },
  editorialImage: { width: "100%", height: 152, backgroundColor: colors.surfaceMuted },
  editorialBody: { padding: spacing.lg, gap: spacing.xs },
  editorialType: { color: colors.coral, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  editorialTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  editorialDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  productFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  productPrice: { color: colors.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  complianceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  });
}
