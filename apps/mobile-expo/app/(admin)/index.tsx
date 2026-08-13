import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { adminApi, paymentMethods, uploadAdminFile } from "@/api/client";
import type { AdminMember, MemberCard, Payment } from "@/api/types";
import { Field, GhostButton, Loading, Metric, Pill, PrimaryButton, Row, Screen, SectionHeader } from "@/components/ui";
import i18n from "@/i18n";
import { useSession } from "@/state/session";
import { useTheme, useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { localizedApiError } from "@/utils/api-error";

type AdminTab = "dashboard" | "members" | "schedule" | "content" | "commerce" | "settings";
type IconName = "grid-outline" | "people-outline" | "calendar-outline" | "images-outline" | "bag-handle-outline" | "settings-outline";
type AdminResource = "coaches" | "courses" | "course-sessions" | "content-blocks" | "products" | "orders";
type ManagedResource = Extract<AdminResource, "courses" | "content-blocks" | "products">;

const tabs: Array<{ id: AdminTab; icon: IconName }> = [
  { id: "dashboard", icon: "grid-outline" },
  { id: "members", icon: "people-outline" },
  { id: "schedule", icon: "calendar-outline" },
  { id: "content", icon: "images-outline" },
  { id: "commerce", icon: "bag-handle-outline" },
  { id: "settings", icon: "settings-outline" }
];

export default function AdminScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const { colors, styles } = useAdminTheme();

  if (!session.token) return <Loading />;

  return (
    <Screen title={t("admin")} eyebrow={t("adminMobileAdministration")} action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
      <View style={styles.tabShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item.id} onPress={() => setTab(item.id)} style={[styles.tab, tab === item.id && styles.activeTab]}>
              <Ionicons name={item.icon} size={17} color={tab === item.id ? colors.white : colors.muted} />
              <Text style={[styles.tabText, tab === item.id && styles.activeTabText]}>{t(item.id)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {tab === "dashboard" ? <Dashboard locale={session.locale} /> : null}
      {tab === "members" ? <Members locale={session.locale} /> : null}
      {tab === "schedule" ? <ResourceHub locale={session.locale} resources={["coaches", "courses", "course-sessions"]} /> : null}
      {tab === "content" ? <ResourceHub locale={session.locale} resources={["content-blocks"]} /> : null}
      {tab === "commerce" ? <Commerce locale={session.locale} /> : null}
      {tab === "settings" ? <Settings locale={session.locale} /> : null}
    </Screen>
  );
}

function Dashboard({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useAdminTheme();
  const query = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  if (query.isLoading) return <Loading />;
  if (query.error) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <QueryErrorNotice title={t("adminDashboardLoadError")} error={query.error} onRetry={query.refetch} />
      </ScrollView>
    );
  }
  const data = query.data;
  const metrics = Object.entries(data?.metrics ?? {});

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.kicker}>{t("adminOperationsOverview")}</Text>
        <Text style={styles.pageTitle}>{t("adminStudioInRhythm")}</Text>
        <Text style={styles.pageMeta}>{t("adminDashboardDescription")}</Text>
      </View>

      <View style={styles.metricGrid}>
        {metrics.slice(0, 4).map(([key, value], index) => (
          <Metric
            key={key}
            label={adminDataLabel(t, key)}
            value={value}
            icon={index % 2 ? "calendar-outline" : "analytics-outline"}
            tone={index === 1 ? "blue" : index === 2 ? "coral" : "sage"}
          />
        ))}
      </View>

      <SectionHeader title={t("adminNeedsAttention")} meta={t("adminPendingOperationalWork")} />
      <View style={styles.actionList}>
        {Object.entries(data?.pending ?? {}).map(([key, value]) => (
          <View key={key} style={styles.actionItem}>
            <View style={styles.actionIcon}><Ionicons name="alert-circle-outline" size={20} color={colors.coral} /></View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>{adminDataLabel(t, key)}</Text>
              <Text style={styles.actionMeta}>{t("adminReviewRelevantWorkspace")}</Text>
            </View>
            <Text style={styles.actionCount}>{value}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title={t("adminTodaySessions")} meta={t("adminScheduledCount", { count: data?.todaySessions.length ?? 0 })} />
      <View style={styles.list}>
        {(data?.todaySessions ?? []).map((item) => (
          <View key={item.id} style={styles.sessionRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeText}>{formatTime(item.startsAt, locale)}</Text>
              <Text style={styles.dayText}>{new Date(item.startsAt).toLocaleDateString(locale, { weekday: "short" })}</Text>
            </View>
            <View style={styles.sessionCopy}>
              <Text style={styles.resourceTitle}>{localizedValue(item.course?.title, locale, item.courseId)}</Text>
              <Text style={styles.resourceMeta}>
                {item.coach?.name ?? item.coachId} · {t("adminBookedCapacity", { booked: item.bookedCount, capacity: item.capacity })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
        ))}
        {!data?.todaySessions.length ? <Text style={styles.empty}>{t("adminNoSessionsToday")}</Text> : null}
      </View>
    </ScrollView>
  );
}

function Members({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  const [queryText, setQueryText] = useState("");
  const members = useQuery({ queryKey: ["admin-members"], queryFn: adminApi.members });
  const cards = useQuery({ queryKey: ["admin-member-cards"], queryFn: adminApi.memberCards });
  if (members.isLoading || cards.isLoading) return <Loading />;

  const filtered = (members.data ?? []).filter((member) =>
    `${member.name} ${member.email ?? ""} ${member.phone ?? ""}`.toLowerCase().includes(queryText.toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>{t("members")}</Text>
        <Text style={styles.pageMeta}>{t("adminMembersDescription")}</Text>
      </View>
      {members.error ? (
        <QueryErrorNotice title={t("adminMembersLoadError")} error={members.error} onRetry={members.refetch} />
      ) : (
        <>
          <Field value={queryText} onChangeText={setQueryText} placeholder={t("adminMemberSearchPlaceholder")} />
          <View style={styles.list}>
            {filtered.map((member) => <MemberRow key={member.id} member={member} onUpdated={() => members.refetch()} />)}
            {!filtered.length ? <Text style={styles.empty}>{t("adminNoMembersFound")}</Text> : null}
          </View>
        </>
      )}

      <SectionHeader title={t("memberCards")} meta={t("adminCardCount", { count: cards.data?.length ?? 0 })} />
      {cards.error ? (
        <QueryErrorNotice title={t("adminCardsLoadError")} error={cards.error} onRetry={cards.refetch} />
      ) : (
        <View style={styles.list}>
          {(cards.data ?? []).map((card) => <MemberCardRow key={card.id} card={card} locale={locale} onUpdated={() => cards.refetch()} />)}
        </View>
      )}
    </ScrollView>
  );
}

function MemberRow({ member, onUpdated }: { member: AdminMember; onUpdated: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const { colors, styles } = useAdminTheme();
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}><Text style={styles.memberInitials}>{initials(member.name)}</Text></View>
      <View style={styles.memberCopy}>
        <Text style={styles.resourceTitle}>{member.name}</Text>
        <Text style={styles.resourceMeta}>{member.email ?? member.phone ?? t("adminNoContactDetail")}</Text>
        <View style={styles.memberStats}>
          <Text style={styles.miniStat}>{t("adminBookingCount", { count: member.bookings.length })}</Text>
          <Text style={styles.miniStat}>{t("adminOrderCount", { count: member.orders.length })}</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={t("adminSetKoreanLocale")}
        onPress={() => void runAction(t("adminUpdateMemberError"), async () => {
          await adminApi.updateMember(member.id, { locale: "ko" });
          await onUpdated();
        })}
        style={styles.roundAction}
      >
        <Ionicons name="language-outline" size={19} color={colors.text} />
      </Pressable>
    </View>
  );
}

function MemberCardRow({ card, locale, onUpdated }: { card: MemberCard; locale: string; onUpdated: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceTop}>
        <View>
          <Text style={styles.resourceTitle}>{t("studioPass")}</Text>
          <Text style={styles.resourceMeta}>
            {t("adminCardCreditsExpiry", {
              remaining: card.remainingCredits,
              total: card.totalCredits,
              date: shortDate(card.expiresAt, locale)
            })}
          </Text>
        </View>
        <Pill label={statusLabel(t, card.status)} tone={card.status === "active" ? "sage" : "coral"} />
      </View>
      <View style={styles.inlineActions}>
        <ActionButton label={t("adminFreeze")} icon="pause-outline" onPress={() => confirmAction(t("adminConfirmFreezeCard"), async () => {
          await adminApi.freezeCard(card.id, {});
          await onUpdated();
        })} />
        <ActionButton label={t("adminExtend")} icon="calendar-outline" onPress={() => void runAction(t("adminExtendCardError"), async () => {
          await adminApi.extendCard(card.id, { days: 30 });
          await onUpdated();
        })} />
        <ActionButton label={t("adminUpgrade")} icon="arrow-up-outline" onPress={() => void runAction(t("adminUpgradeCardError"), async () => {
          await adminApi.upgradeCard(card.id, { addCredits: 2 });
          await onUpdated();
        })} />
      </View>
    </View>
  );
}

function ResourceHub({ resources, locale }: { resources: readonly AdminResource[]; locale: string }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  const [resource, setResource] = useState<AdminResource>(resources[0]);
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>{resourceLabel(t, resource)}</Text>
        <Text style={styles.pageMeta}>
          {isManagedResource(resource)
            ? t("adminManagedResourceDescription")
            : t("adminReadOnlyResourceDescription")}
        </Text>
      </View>
      <View style={styles.segmented}>
        {resources.map((item) => (
          <Pressable key={item} onPress={() => setResource(item)} style={[styles.segment, resource === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, resource === item && styles.segmentTextActive]}>{resourceLabel(t, item)}</Text>
          </Pressable>
        ))}
      </View>
      <ResourceList resource={resource} locale={locale} />
    </ScrollView>
  );
}

function ResourceList({ resource, locale }: { resource: AdminResource; locale: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useAdminTheme();
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ["admin-resource", resource],
    queryFn: () => adminApi.resource<Record<string, unknown>>(resource)
  });
  if (query.isLoading) return <Loading />;
  if (query.error) {
    return (
      <QueryErrorNotice
        title={t("adminResourceLoadError", { resource: resourceLabel(t, resource) })}
        error={query.error}
        onRetry={query.refetch}
      />
    );
  }

  const managed = isManagedResource(resource);

  async function createResource(imageUrl?: string) {
    if (!managed || creating) return;
    setCreating(true);
    try {
      await adminApi.createResource(resource, sampleEntity(resource, imageUrl));
      await query.refetch();
    } catch (error) {
      Alert.alert(t("adminCreateResourceError"), localizedApiError(error, t));
    } finally {
      setCreating(false);
    }
  }

  function beginCreate() {
    if (resource !== "courses") {
      confirmCreate(t("adminConfirmCreateTitle", { resource: resourceLabel(t, resource) }), () => createResource());
      return;
    }
    Alert.alert(t("adminCourseImageChoiceTitle"), t("adminCourseImageChoiceMessage"), [
      { text: t("adminCancel"), style: "cancel" },
      { text: t("adminCreateWithoutImage"), onPress: () => void createResource() },
      {
        text: t("adminChooseCourseImage"),
        onPress: () => void (async () => {
          const imageUrl = await chooseAndUploadCourseImage(t);
          if (imageUrl) await createResource(imageUrl);
        })()
      }
    ]);
  }

  return (
    <View style={styles.list}>
      {managed ? (
        <PrimaryButton
          title={t("adminCreateSampleResource", { resource: resourceLabel(t, resource) })}
          icon="add"
          disabled={creating}
          onPress={beginCreate}
        />
      ) : (
        <View accessibilityRole="alert" style={styles.readOnlyNotice}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.accentDark} />
          <View style={styles.noticeCopy}>
            <Text selectable style={styles.noticeTitle}>{t("adminReadOnlyResource")}</Text>
            <Text selectable style={styles.noticeText}>{t("adminReadOnlyResourceNotice")}</Text>
          </View>
        </View>
      )}
      {(query.data ?? []).map((item) => {
        const id = String(item.id);
        const active = item.active !== false;
        return (
          <View key={id} style={styles.resourceCard}>
            {resource === "courses" && typeof item.imageUrl === "string" ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.courseImage}
                resizeMode="cover"
                accessibilityLabel={entityTitle(item, resource, locale, t)}
              />
            ) : null}
            <View style={styles.resourceTop}>
              <View style={styles.resourceHeading}>
                <Text style={styles.resourceTitle}>{entityTitle(item, resource, locale, t)}</Text>
                <Text style={styles.resourceMeta}>{id}</Text>
              </View>
              <Pill
                label={statusLabel(t, String(item.status ?? (managed ? (active ? "active" : "inactive") : "read-only")))}
                tone={(!managed && item.status === undefined) || item.active === false ? "neutral" : "sage"}
              />
            </View>
            {managed ? (
              <View style={styles.inlineActions}>
                <ActionButton
                  label={active ? t("adminDeactivate") : t("adminActivate")}
                  icon={active ? "eye-off-outline" : "eye-outline"}
                  onPress={() => void runAction(t("adminUpdateResourceError", { resource: resourceLabel(t, resource) }), async () => {
                    await adminApi.updateResource(resource, id, { active: !active });
                    await query.refetch();
                  })}
                />
                <ActionButton label={t("adminDelete")} icon="trash-outline" danger onPress={() => confirmAction(t("adminConfirmDeleteResource", { resource: resourceLabel(t, resource) }), async () => {
                  await adminApi.deleteResource(resource, id);
                  await query.refetch();
                })} />
              </View>
            ) : null}
          </View>
        );
      })}
      {!query.data?.length ? <Text style={styles.empty}>{t("adminNoResourceItems", { resource: resourceLabel(t, resource) })}</Text> : null}
    </View>
  );
}

function Commerce({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  const [resource, setResource] = useState<"products" | "orders" | "payments">("products");
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>{t("commerce")}</Text>
        <Text style={styles.pageMeta}>{t("adminCommerceDescription")}</Text>
      </View>
      <View style={styles.segmented}>
        {(["products", "orders", "payments"] as const).map((item) => (
          <Pressable key={item} onPress={() => setResource(item)} style={[styles.segment, resource === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, resource === item && styles.segmentTextActive]}>{resourceLabel(t, item)}</Text>
          </Pressable>
        ))}
      </View>
      {resource === "payments" ? <Payments locale={locale} /> : <ResourceList resource={resource} locale={locale} />}
    </ScrollView>
  );
}

function Payments({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  const query = useQuery({ queryKey: ["admin-payments"], queryFn: adminApi.payments });
  if (query.isLoading) return <Loading />;
  if (query.error) {
    return <QueryErrorNotice title={t("adminPaymentsLoadError")} error={query.error} onRetry={query.refetch} />;
  }
  return (
    <View style={styles.list}>
      {(query.data ?? []).map((payment) => (
        <PaymentRow key={payment.id} payment={payment} locale={locale} onUpdated={() => query.refetch()} />
      ))}
      {!query.data?.length ? <Text style={styles.empty}>{t("adminNoPayments")}</Text> : null}
    </View>
  );
}

function PaymentRow({ payment, locale, onUpdated }: { payment: Payment; locale: string; onUpdated: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const { styles } = useAdminTheme();
  const requestInFlight = useRef(false);
  const refundedAmount = safeAmount(payment.refundedAmount);
  const refundableAmount = payment.status === "succeeded"
    ? Math.max(0, safeAmount(payment.refundableAmount ?? payment.amount - refundedAmount))
    : 0;
  const [refundAmount, setRefundAmount] = useState(String(refundableAmount || ""));
  const [refunding, setRefunding] = useState(false);
  const normalizedAmount = Number(refundAmount);
  const validAmount = Number.isSafeInteger(normalizedAmount)
    && normalizedAmount > 0
    && normalizedAmount <= refundableAmount;

  useEffect(() => {
    setRefundAmount(String(refundableAmount || ""));
  }, [refundableAmount]);

  function confirmRefund() {
    if (!validAmount || requestInFlight.current) return;
    Alert.alert(t("adminConfirmRefund"), t("adminConfirmActionMessage"), [
      { text: t("adminCancel"), style: "cancel" },
      { text: t("adminConfirm"), style: "destructive", onPress: () => void submitRefund() }
    ]);
  }

  async function submitRefund() {
    if (!validAmount || requestInFlight.current) return;
    requestInFlight.current = true;
    setRefunding(true);
    try {
      await adminApi.refund(payment.id, { amount: normalizedAmount, reason: "mobile_admin" });
      await onUpdated();
      Alert.alert(t("adminRefundSuccess"));
    } catch (error) {
      Alert.alert(t("adminActionFailedTitle"), localizedApiError(error, t));
    } finally {
      requestInFlight.current = false;
      setRefunding(false);
    }
  }

  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceTop}>
        <View>
          <Text style={styles.resourceTitle}>{payment.paymentMethodCode.toUpperCase()}</Text>
          <Text style={styles.resourceMeta}>{formatAmount(payment.amount, payment.currency, locale)} · {payment.country}</Text>
        </View>
        <Pill label={statusLabel(t, payment.status)} tone={payment.status === "succeeded" ? "sage" : "blue"} />
      </View>
      <Row label={t("adminRefundedAmount")} value={formatAmount(refundedAmount, payment.currency, locale)} />
      <Row label={t("adminRefundableAmount")} value={formatAmount(refundableAmount, payment.currency, locale)} />
      {refundableAmount > 0 ? (
        <View style={styles.refundControls}>
          <Text style={styles.resourceMeta}>{t("adminRefundAmount")}</Text>
          <Field value={refundAmount} onChangeText={setRefundAmount} placeholder={String(refundableAmount)} keyboardType="number-pad" />
          <ActionButton
            label={t(refunding ? "adminRefunding" : "adminIssueRefund")}
            icon="return-down-back-outline"
            danger
            disabled={!validAmount || refunding}
            onPress={confirmRefund}
          />
        </View>
      ) : null}
    </View>
  );
}

function safeAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function Settings({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useAdminTheme();
  const uploadRequestInFlight = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPreviewUri, setUploadPreviewUri] = useState<string | null>(null);
  const [uploadPublicUrl, setUploadPublicUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: adminApi.auditLogs });
  const methods = useQuery({ queryKey: ["admin-payment-methods"], queryFn: () => paymentMethods("US", "USD") });
  if (audit.isLoading || methods.isLoading) return <Loading />;

  async function chooseAndUploadImage() {
    if (uploadRequestInFlight.current) return;
    uploadRequestInFlight.current = true;
    setUploading(true);
    setUploadError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("photoPermissionTitle"), t("photoPermissionMessage"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "image/jpeg";
      const fileName = asset.fileName ?? `admin-image-${Date.now()}.${extensionForMimeType(contentType)}`;
      setUploadPreviewUri(asset.uri);
      setUploadPublicUrl(null);

      const upload = await adminApi.presignUpload({
        scope: "content",
        fileName,
        contentType
      });
      const localResponse = await fetch(asset.uri);
      if (!localResponse.ok) throw new Error(t("unableToReadImage"));
      await uploadAdminFile(upload, contentType, await localResponse.blob());

      setUploadPublicUrl(upload.publicUrl);
      Alert.alert(t("uploadCompleteTitle"), t("uploadCompleteMessage"));
    } catch (error) {
      const message = t("uploadFailedMessage");
      setUploadError(message);
      Alert.alert(t("uploadFailedTitle"), message);
    } finally {
      uploadRequestInFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>{t("settings")}</Text>
        <Text style={styles.pageMeta}>{t("adminSettingsDescription")}</Text>
      </View>

      <SectionHeader title={t("adminStripeMethods")} meta="US · USD" />
      {methods.error ? (
        <QueryErrorNotice title={t("paymentMethodsErrorTitle")} error={methods.error} onRetry={methods.refetch} />
      ) : (
        <View style={styles.resourceCard}>
          {(methods.data ?? []).map((method) => <Row key={method.code} label={method.code} value={paymentFlowLabel(t, method.flow)} />)}
        </View>
      )}

      <SectionHeader title={t("adminMediaStorage")} meta={t("adminS3Uploads")} />
      <PrimaryButton
        title={uploading ? t("uploadingImage") : t("chooseAndUploadImage")}
        icon="cloud-upload-outline"
        disabled={uploading}
        onPress={() => void chooseAndUploadImage()}
      />
      {uploadPreviewUri ? (
        <View style={styles.uploadResult}>
          <Image source={{ uri: uploadPreviewUri }} style={styles.uploadPreview} resizeMode="cover" />
          <View style={styles.uploadCopy}>
            <Text style={styles.resourceTitle}>{uploadPublicUrl ? t("uploadCompleteTitle") : t("selectedImage")}</Text>
            {uploadPublicUrl ? (
              <Text selectable style={styles.publicUrl}>{uploadPublicUrl}</Text>
            ) : (
              <Text selectable style={styles.resourceMeta}>{t("uploadWaitingMessage")}</Text>
            )}
          </View>
        </View>
      ) : null}
      {uploadError ? (
        <View accessibilityRole="alert" style={styles.uploadError}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text selectable style={styles.uploadErrorText}>{uploadError}</Text>
        </View>
      ) : null}

      <SectionHeader title={t("adminAuditHistory")} meta={t("adminAuditHistoryMeta")} />
      {audit.error ? (
        <QueryErrorNotice title={t("adminAuditLoadError")} error={audit.error} onRetry={audit.refetch} />
      ) : (
        <View style={styles.list}>
          {(audit.data ?? []).slice(-20).reverse().map((log) => (
            <View key={log.id} style={styles.auditRow}>
              <View style={styles.auditIcon}><Ionicons name="shield-checkmark-outline" size={18} color={colors.accentDark} /></View>
              <View style={styles.auditCopy}>
                <Text style={styles.resourceTitle}>{auditActionLabel(t, log.action)}</Text>
                <Text style={styles.resourceMeta}>{t(log.actorRole)} · {new Date(log.createdAt).toLocaleString(locale)}</Text>
              </View>
            </View>
          ))}
          {!audit.data?.length ? <Text style={styles.empty}>{t("adminNoAuditEvents")}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

function QueryErrorNotice({
  title,
  error: _error,
  onRetry
}: {
  title: string;
  error: unknown;
  onRetry: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { colors, styles } = useAdminTheme();
  return (
    <View accessibilityRole="alert" style={styles.queryError}>
      <View style={styles.queryErrorHeader}>
        <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
        <View style={styles.noticeCopy}>
          <Text selectable style={styles.noticeTitle}>{title}</Text>
          <Text selectable style={styles.noticeText}>{t("queryErrorMessage")}</Text>
        </View>
      </View>
      <GhostButton title={t("retry")} icon="refresh-outline" onPress={() => void onRetry()} />
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  danger = false,
  disabled = false
}: {
  label: string;
  icon: "pause-outline" | "calendar-outline" | "arrow-up-outline" | "eye-outline" | "eye-off-outline" | "trash-outline" | "return-down-back-outline";
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors, styles } = useAdminTheme();

  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, danger && styles.dangerButton, disabled && styles.disabledAction, pressed && !disabled && styles.pressed]}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionButtonText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function confirmAction(title: string, action: () => Promise<void>) {
  Alert.alert(title, i18n.t("adminConfirmActionMessage"), [
    { text: i18n.t("adminCancel"), style: "cancel" },
    { text: i18n.t("adminConfirm"), style: "destructive", onPress: () => void runAction(i18n.t("adminActionFailedTitle"), action) }
  ]);
}

function confirmCreate(title: string, action: () => Promise<void>) {
  Alert.alert(title, i18n.t("adminConfirmCreateMessage"), [
    { text: i18n.t("adminCancel"), style: "cancel" },
    { text: i18n.t("adminCreate"), onPress: () => void runAction(i18n.t("adminCreateResourceError"), action) }
  ]);
}

async function runAction(title: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    Alert.alert(title, i18n.t("adminActionFailedMessage"));
  }
}

async function chooseAndUploadCourseImage(t: TFunction) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(t("photoPermissionTitle"), t("photoPermissionMessage"));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const contentType = asset.mimeType ?? "image/jpeg";
  const fileName = asset.fileName ?? `course-${Date.now()}.${extensionForMimeType(contentType)}`;
  if (asset.fileSize && asset.fileSize > 10_000_000) {
    Alert.alert(t("uploadFailedTitle"), t("avatarTooLarge"));
    return null;
  }
  try {
    const upload = await adminApi.presignUpload({
      scope: "courses",
      fileName,
      contentType,
      fileSize: asset.fileSize
    });
    const localResponse = await fetch(asset.uri);
    if (!localResponse.ok) throw new Error(t("unableToReadImage"));
    await uploadAdminFile(upload, contentType, await localResponse.blob());
    return upload.publicUrl;
  } catch (error) {
    Alert.alert(t("uploadFailedTitle"), localizedApiError(error, t));
    return null;
  }
}

function sampleEntity(resource: ManagedResource, imageUrl?: string): Record<string, unknown> {
  switch (resource) {
    case "courses":
      return {
        title: { en: "Good Vibe Signature Flow", "zh-Hans": "Good Vibe 招牌流瑜伽", ko: "Good Vibe 시그니처 플로우" },
        description: {
          en: "A balanced sample class created from the mobile admin.",
          "zh-Hans": "从移动管理端创建的均衡样例课程。",
          ko: "모바일 관리자에서 만든 균형 잡힌 샘플 수업입니다."
        },
        durationMinutes: 60,
        priceAmount: 50000,
        currency: "USD",
        capacity: 8,
        memberCardDeductCount: 1,
        ...(imageUrl ? { imageUrl } : {}),
        tags: ["sample"],
        active: true
      };
    case "content-blocks":
      return {
        type: "knowledge",
        title: { en: "Good Vibe Wellness Note", "zh-Hans": "Good Vibe 健康贴士", ko: "Good Vibe 웰니스 노트" },
        description: {
          en: "Breathe steadily and move with intention.",
          "zh-Hans": "稳定呼吸，有意识地运动。",
          ko: "호흡을 고르게 유지하며 의식적으로 움직이세요."
        },
        target: "home",
        sortOrder: 100,
        active: true
      };
    case "products":
      return {
        title: { en: "Good Vibe Studio Mat", "zh-Hans": "Good Vibe 瑜伽垫", ko: "Good Vibe 스튜디오 매트" },
        description: {
          en: "A sample studio mat created from the mobile admin.",
          "zh-Hans": "从移动管理端创建的样例瑜伽垫。",
          ko: "모바일 관리자에서 만든 샘플 스튜디오 매트입니다."
        },
        category: "yoga_mat",
        priceAmount: 30000,
        currency: "USD",
        stock: 5,
        active: true
      };
  }
}

function isManagedResource(resource: AdminResource): resource is ManagedResource {
  return resource === "courses" || resource === "content-blocks" || resource === "products";
}

function entityTitle(item: Record<string, unknown>, fallback: string, locale: string, t: TFunction) {
  return localizedValue(item.title, locale, resourceLabel(t, fallback));
}

function localizedValue(value: unknown, locale: string, fallback: string) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return fallback;
  const localized = value as Record<string, unknown>;
  const candidate = localized[locale]
    ?? (locale === "zh-Hans" ? localized.zh : undefined)
    ?? localized.en
    ?? localized.ko;
  return typeof candidate === "string" ? candidate : fallback;
}

function resourceLabel(t: TFunction, resource: string) {
  const keys: Record<string, string> = {
    coaches: "adminResourceCoaches",
    courses: "adminResourceCourses",
    "course-sessions": "adminResourceCourseSessions",
    "content-blocks": "adminResourceContentBlocks",
    products: "adminResourceProducts",
    orders: "adminResourceOrders",
    payments: "adminResourcePayments"
  };
  return t(keys[resource] ?? "adminUnknownResource");
}

function adminDataLabel(t: TFunction, key: string) {
  const keys: Record<string, string> = {
    members: "members",
    coaches: "adminResourceCoaches",
    courses: "adminResourceCourses",
    bookings: "bookings",
    orders: "adminResourceOrders",
    payments: "adminResourcePayments",
    pendingPaymentBookings: "adminPendingPaymentBookings",
    lowStockProducts: "adminLowStockProducts",
    expiringCards: "adminExpiringCards"
  };
  return t(keys[key] ?? "adminUnknownMetric");
}

function statusLabel(t: TFunction, status: string) {
  const keys: Record<string, string> = {
    active: "statusActive",
    inactive: "statusInactive",
    frozen: "statusFrozen",
    expired: "statusExpired",
    transferred: "statusTransferred",
    upgraded: "statusUpgraded",
    pending_payment: "statusPendingPayment",
    confirmed: "statusConfirmed",
    cancelled: "statusCancelled",
    checked_in: "statusCheckedIn",
    succeeded: "statusSucceeded",
    requires_payment_method: "statusRequiresPaymentMethod",
    requires_action: "statusRequiresAction",
    processing: "statusProcessing",
    failed: "statusFailed",
    refunded: "statusRefunded",
    paid: "statusPaid",
    pending: "statusPending",
    open: "statusOpen",
    closed: "statusClosed",
    completed: "statusCompleted",
    "read-only": "statusReadOnly"
  };
  return t(keys[status] ?? "statusUnknown");
}

function paymentFlowLabel(t: TFunction, flow: string) {
  const keys: Record<string, string> = {
    native_or_checkout: "adminPaymentFlowNativeOrCheckout",
    redirect: "adminPaymentFlowRedirect",
    checkout_redirect: "adminPaymentFlowCheckoutRedirect"
  };
  return t(keys[flow] ?? "adminPaymentFlowUnknown");
}

function auditActionLabel(t: TFunction, action: string) {
  const keys: Record<string, string> = {
    "admin.member.update": "adminAuditMemberUpdated",
    "admin.upload.presign": "adminAuditUploadPrepared",
    "booking.create": "adminAuditBookingCreated",
    "booking.cancel": "adminAuditBookingCancelled",
    "booking.reschedule": "adminAuditBookingRescheduled",
    "booking.check_in": "adminAuditBookingCheckedIn",
    "order.create": "adminAuditOrderCreated",
    "payment.refund": "adminAuditPaymentRefunded",
    "member_card.freeze": "adminAuditCardFrozen",
    "member_card.extend": "adminAuditCardExtended",
    "member_card.transfer": "adminAuditCardTransferred",
    "member_card.upgrade": "adminAuditCardUpgraded"
  };
  const exactKey = keys[action];
  if (exactKey) return t(exactKey);

  const resourceAction = action.match(/^admin\.(.+)\.(create|update|delete)$/);
  if (resourceAction) {
    const actionKeys = {
      create: "adminAuditResourceCreated",
      update: "adminAuditResourceUpdated",
      delete: "adminAuditResourceDeleted"
    } as const;
    return t(actionKeys[resourceAction[2] as keyof typeof actionKeys], {
      resource: resourceLabel(t, resourceAction[1])
    });
  }
  return t("adminAuditEventRecorded");
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function shortDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic" || mimeType === "image/heif") return "heic";
  return "jpg";
}

function useAdminTheme() {
  const { colors } = useTheme();
  return { colors, styles: useThemedStyles(createStyles) };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  tabShell: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: 12, borderRadius: radius.md },
  activeTab: { backgroundColor: colors.black },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  activeTabText: { color: colors.white },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  kicker: { color: colors.coral, fontSize: 10, fontWeight: "800" },
  pageTitle: { color: colors.text, fontSize: 28, fontWeight: "800" },
  pageMeta: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionList: { gap: spacing.sm },
  actionItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  actionIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  actionMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  actionCount: { color: colors.coral, fontSize: 20, fontWeight: "800" },
  list: { gap: spacing.md },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: spacing.xl },
  sessionRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  timeBlock: { width: 58, alignItems: "center", borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line, paddingRight: spacing.md },
  timeText: { color: colors.coral, fontSize: 13, fontWeight: "800" },
  dayText: { color: colors.muted, fontSize: 10, marginTop: 2 },
  sessionCopy: { flex: 1, minWidth: 0 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  memberInitials: { color: colors.accentDark, fontWeight: "800" },
  memberCopy: { flex: 1, minWidth: 0 },
  memberStats: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  miniStat: { color: colors.muted, fontSize: 10 },
  roundAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  resourceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  courseImage: { width: "100%", height: 168, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  resourceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  resourceHeading: { flex: 1, minWidth: 0 },
  resourceTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  resourceMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  refundControls: { gap: spacing.sm },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  readOnlyNotice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: spacing.md },
  queryError: { gap: spacing.md, backgroundColor: colors.coralSoft, borderWidth: 1, borderColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.lg },
  queryErrorHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  noticeText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  actionButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted },
  dangerButton: { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft },
  disabledAction: { opacity: 0.45 },
  actionButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  dangerText: { color: colors.danger },
  segmented: { flexDirection: "row", backgroundColor: colors.surfaceMuted, padding: 4, borderRadius: radius.md },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center" },
  segmentTextActive: { color: colors.text },
  auditRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  auditIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  auditCopy: { flex: 1, minWidth: 0 },
  uploadResult: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  uploadPreview: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  uploadCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  publicUrl: { color: colors.blue, fontSize: 12, lineHeight: 18 },
  uploadError: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  uploadErrorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.68 }
  });
}
