import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { adminApi, paymentMethods } from "@/api/client";
import type { AdminMember, MemberCard, Payment } from "@/api/types";
import { Field, GhostButton, Loading, Metric, Pill, PrimaryButton, Row, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { colors, radius, spacing } from "@/theme/tokens";

type AdminTab = "dashboard" | "members" | "schedule" | "content" | "commerce" | "settings";
type IconName = "grid-outline" | "people-outline" | "calendar-outline" | "images-outline" | "bag-handle-outline" | "settings-outline";

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

  if (!session.token) return <Loading />;

  return (
    <Screen title={t("admin")} eyebrow="Mobile administration" action={<GhostButton title={t("logout")} onPress={() => void session.logout()} />}>
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
      {tab === "dashboard" ? <Dashboard /> : null}
      {tab === "members" ? <Members /> : null}
      {tab === "schedule" ? <ResourceHub resources={["coaches", "courses", "course-sessions"]} /> : null}
      {tab === "content" ? <ResourceHub resources={["content-blocks"]} /> : null}
      {tab === "commerce" ? <Commerce /> : null}
      {tab === "settings" ? <Settings /> : null}
    </Screen>
  );
}

function Dashboard() {
  const query = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.dashboard });
  if (query.isLoading) return <Loading />;
  const data = query.data;
  const metrics = Object.entries(data?.metrics ?? {});

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.kicker}>OPERATIONS OVERVIEW</Text>
        <Text style={styles.pageTitle}>The studio is in rhythm.</Text>
        <Text style={styles.pageMeta}>Live activity, today’s sessions, and work that needs attention.</Text>
      </View>

      <View style={styles.metricGrid}>
        {metrics.slice(0, 4).map(([key, value], index) => (
          <Metric
            key={key}
            label={humanize(key)}
            value={value}
            icon={index % 2 ? "calendar-outline" : "analytics-outline"}
            tone={index === 1 ? "blue" : index === 2 ? "coral" : "sage"}
          />
        ))}
      </View>

      <SectionHeader title="Needs attention" meta="Pending operational work" />
      <View style={styles.actionList}>
        {Object.entries(data?.pending ?? {}).map(([key, value]) => (
          <View key={key} style={styles.actionItem}>
            <View style={styles.actionIcon}><Ionicons name="alert-circle-outline" size={20} color={colors.coral} /></View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>{humanize(key)}</Text>
              <Text style={styles.actionMeta}>Review and resolve from the relevant workspace.</Text>
            </View>
            <Text style={styles.actionCount}>{value}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Today’s sessions" meta={`${data?.todaySessions.length ?? 0} scheduled`} />
      <View style={styles.list}>
        {(data?.todaySessions ?? []).map((item) => (
          <View key={item.id} style={styles.sessionRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeText}>{formatTime(item.startsAt)}</Text>
              <Text style={styles.dayText}>{new Date(item.startsAt).toLocaleDateString([], { weekday: "short" })}</Text>
            </View>
            <View style={styles.sessionCopy}>
              <Text style={styles.resourceTitle}>{String(item.course?.title ?? item.courseId)}</Text>
              <Text style={styles.resourceMeta}>{item.coach?.name ?? item.coachId} · {item.bookedCount}/{item.capacity}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Members() {
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
        <Text style={styles.pageTitle}>Members</Text>
        <Text style={styles.pageMeta}>Profiles, activity, membership cards, and health records.</Text>
      </View>
      <Field value={queryText} onChangeText={setQueryText} placeholder="Search by name, email, or phone" />
      <View style={styles.list}>
        {filtered.map((member) => <MemberRow key={member.id} member={member} onUpdated={() => members.refetch()} />)}
      </View>

      <SectionHeader title="Membership cards" meta={`${cards.data?.length ?? 0} cards`} />
      <View style={styles.list}>
        {(cards.data ?? []).map((card) => <MemberCardRow key={card.id} card={card} onUpdated={() => cards.refetch()} />)}
      </View>
    </ScrollView>
  );
}

function MemberRow({ member, onUpdated }: { member: AdminMember; onUpdated: () => Promise<unknown> }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}><Text style={styles.memberInitials}>{initials(member.name)}</Text></View>
      <View style={styles.memberCopy}>
        <Text style={styles.resourceTitle}>{member.name}</Text>
        <Text style={styles.resourceMeta}>{member.email ?? member.phone ?? "No contact detail"}</Text>
        <View style={styles.memberStats}>
          <Text style={styles.miniStat}>{member.bookings.length} bookings</Text>
          <Text style={styles.miniStat}>{member.orders.length} orders</Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Set Korean locale"
        onPress={() => void runAction("Unable to update member", async () => {
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

function MemberCardRow({ card, onUpdated }: { card: MemberCard; onUpdated: () => Promise<unknown> }) {
  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceTop}>
        <View>
          <Text style={styles.resourceTitle}>Studio Pass</Text>
          <Text style={styles.resourceMeta}>{card.remainingCredits}/{card.totalCredits} credits · expires {shortDate(card.expiresAt)}</Text>
        </View>
        <Pill label={card.status} tone={card.status === "active" ? "sage" : "coral"} />
      </View>
      <View style={styles.inlineActions}>
        <ActionButton label="Freeze" icon="pause-outline" onPress={() => confirmAction("Freeze this card?", async () => {
          await adminApi.freezeCard(card.id, {});
          await onUpdated();
        })} />
        <ActionButton label="Extend" icon="calendar-outline" onPress={() => void runAction("Unable to extend card", async () => {
          await adminApi.extendCard(card.id, { days: 30 });
          await onUpdated();
        })} />
        <ActionButton label="Upgrade" icon="arrow-up-outline" onPress={() => void runAction("Unable to upgrade card", async () => {
          await adminApi.upgradeCard(card.id, { addCredits: 2 });
          await onUpdated();
        })} />
      </View>
    </View>
  );
}

function ResourceHub({ resources }: { resources: string[] }) {
  const [resource, setResource] = useState(resources[0]);
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>{humanize(resource)}</Text>
        <Text style={styles.pageMeta}>Create, review, and update studio resources.</Text>
      </View>
      <View style={styles.segmented}>
        {resources.map((item) => (
          <Pressable key={item} onPress={() => setResource(item)} style={[styles.segment, resource === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, resource === item && styles.segmentTextActive]}>{humanize(item)}</Text>
          </Pressable>
        ))}
      </View>
      <ResourceList resource={resource} />
    </ScrollView>
  );
}

function ResourceList({ resource }: { resource: string }) {
  const query = useQuery({
    queryKey: ["admin-resource", resource],
    queryFn: () => adminApi.resource<Record<string, unknown>>(resource)
  });
  if (query.isLoading) return <Loading />;

  return (
    <View style={styles.list}>
      <PrimaryButton
        title={`Create ${humanize(resource)}`}
        icon="add"
        onPress={() => void runAction(`Unable to create ${humanize(resource)}`, async () => {
          await adminApi.createResource(resource, sampleEntity(resource));
          await query.refetch();
        })}
      />
      {(query.data ?? []).map((item) => {
        const id = String(item.id);
        return (
          <View key={id} style={styles.resourceCard}>
            <View style={styles.resourceTop}>
              <View style={styles.resourceHeading}>
                <Text style={styles.resourceTitle}>{entityTitle(item, resource)}</Text>
                <Text style={styles.resourceMeta}>{id}</Text>
              </View>
              <Pill label={String(item.status ?? (item.active ? "active" : "draft"))} tone={item.active === false ? "neutral" : "sage"} />
            </View>
            <View style={styles.inlineActions}>
              <ActionButton label="Edit" icon="create-outline" onPress={() => void runAction(`Unable to update ${humanize(resource)}`, async () => {
                await adminApi.updateResource(resource, id, { updatedFromMobileAdmin: true });
                await query.refetch();
              })} />
              <ActionButton label="Delete" icon="trash-outline" danger onPress={() => confirmAction(`Delete this ${humanize(resource)} item?`, async () => {
                await adminApi.deleteResource(resource, id);
                await query.refetch();
              })} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Commerce() {
  const [resource, setResource] = useState<"products" | "orders" | "payments">("products");
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>Commerce</Text>
        <Text style={styles.pageMeta}>Products, customer orders, Stripe payments, and refunds.</Text>
      </View>
      <View style={styles.segmented}>
        {(["products", "orders", "payments"] as const).map((item) => (
          <Pressable key={item} onPress={() => setResource(item)} style={[styles.segment, resource === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, resource === item && styles.segmentTextActive]}>{humanize(item)}</Text>
          </Pressable>
        ))}
      </View>
      {resource === "payments" ? <Payments /> : <ResourceList resource={resource} />}
    </ScrollView>
  );
}

function Payments() {
  const query = useQuery({ queryKey: ["admin-payments"], queryFn: adminApi.payments });
  if (query.isLoading) return <Loading />;
  return (
    <View style={styles.list}>
      {(query.data ?? []).map((payment) => (
        <PaymentRow key={payment.id} payment={payment} onUpdated={() => query.refetch()} />
      ))}
    </View>
  );
}

function PaymentRow({ payment, onUpdated }: { payment: Payment; onUpdated: () => Promise<unknown> }) {
  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceTop}>
        <View>
          <Text style={styles.resourceTitle}>{payment.paymentMethodCode.toUpperCase()}</Text>
          <Text style={styles.resourceMeta}>{formatAmount(payment.amount, payment.currency)} · {payment.country}</Text>
        </View>
        <Pill label={payment.status} tone={payment.status === "succeeded" ? "sage" : "blue"} />
      </View>
      <ActionButton label="Issue refund" icon="return-down-back-outline" danger onPress={() => confirmAction("Refund this payment?", async () => {
        await adminApi.refund(payment.id, { reason: "mobile_admin" });
        await onUpdated();
      })} />
    </View>
  );
}

function Settings() {
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: adminApi.auditLogs });
  const methods = useQuery({ queryKey: ["admin-payment-methods"], queryFn: () => paymentMethods("KR", "KRW") });
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageMeta}>Payments, uploads, access, and immutable audit history.</Text>
      </View>

      <SectionHeader title="Stripe methods" meta="KR · KRW" />
      <View style={styles.resourceCard}>
        {(methods.data ?? []).map((method) => <Row key={method.code} label={method.code} value={method.flow} />)}
      </View>

      <SectionHeader title="Media storage" meta="S3-compatible uploads" />
      <PrimaryButton title="Create upload URL" icon="cloud-upload-outline" onPress={() => void runAction("Unable to create upload URL", async () => {
        const upload = await adminApi.presignUpload({ scope: "content", fileName: "image.jpg" });
        Alert.alert("Upload URL", JSON.stringify(upload, null, 2));
      })} />

      <SectionHeader title="Audit history" meta="Read-only · latest 20 events" />
      <View style={styles.list}>
        {(audit.data ?? []).slice(-20).reverse().map((log) => (
          <View key={log.id} style={styles.auditRow}>
            <View style={styles.auditIcon}><Ionicons name="shield-checkmark-outline" size={18} color={colors.accentDark} /></View>
            <View style={styles.auditCopy}>
              <Text style={styles.resourceTitle}>{humanize(log.action)}</Text>
              <Text style={styles.resourceMeta}>{log.actorRole} · {new Date(log.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  danger = false
}: {
  label: string;
  icon: "pause-outline" | "calendar-outline" | "arrow-up-outline" | "create-outline" | "trash-outline" | "return-down-back-outline";
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, danger && styles.dangerButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.actionButtonText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

function confirmAction(title: string, action: () => Promise<void>) {
  Alert.alert(title, "This action is permanent or will be written to the audit log.", [
    { text: "Cancel", style: "cancel" },
    { text: "Confirm", style: "destructive", onPress: () => void runAction("Action failed", action) }
  ]);
}

async function runAction(title: string, action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    Alert.alert(title, error instanceof Error ? error.message : "Request failed");
  }
}

function sampleEntity(resource: string) {
  if (resource === "courses") return {
    title: { en: "Yomi Signature Flow", "zh-Hans": "Yomi 招牌流瑜伽", ko: "Yomi 시그니처 플로우" },
    description: { en: "Created from the Yomi mobile workspace." },
    durationMinutes: 60,
    priceAmount: 50000,
    currency: "KRW",
    capacity: 8,
    memberCardDeductCount: 1
  };
  if (resource === "products") return {
    title: { en: "Yomi Studio Mat", "zh-Hans": "Yomi 瑜伽垫", ko: "Yomi 스튜디오 매트" },
    description: { en: "Created from the Yomi mobile workspace." },
    category: "yoga_mat",
    priceAmount: 30000,
    currency: "KRW",
    stock: 5,
    active: true
  };
  return { title: { en: `Yomi ${humanize(resource)}` }, active: true };
}

function entityTitle(item: Record<string, unknown>, fallback: string) {
  const title = item.title;
  if (typeof title === "string") return title;
  if (title && typeof title === "object") {
    const localized = title as Record<string, unknown>;
    return String(localized.en ?? localized["zh-Hans"] ?? localized.ko ?? humanize(fallback));
  }
  return humanize(fallback);
}

function humanize(value: string) {
  return value.replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const styles = StyleSheet.create({
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
  resourceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  resourceHeading: { flex: 1, minWidth: 0 },
  resourceTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  resourceMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted },
  dangerButton: { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft },
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
  pressed: { opacity: 0.68 }
});
