import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { getLocales } from "expo-localization";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  createPrivacyRequest,
  deleteAccount,
  exportPrivacyData,
  legalUrl,
  memberCards,
  paymentMethods,
  requestMembershipCancellation
} from "@/api/client";
import { PaymentMethodsGrid } from "@/components/payment-methods-grid";
import { GhostButton, QueryErrorNotice, Screen, SectionHeader } from "@/components/ui";
import { useSession } from "@/state/session";
import { useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { localizedApiError } from "@/utils/api-error";
import { resolvePaymentRegion, selectEligibleMemberCard } from "@/utils/booking";

export default function StudentProfileScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const styles = useThemedStyles(createStyles);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);
  const paymentRegion = resolvePaymentRegion(getLocales()[0]?.regionCode);
  const methods = useQuery({
    queryKey: ["payment-methods", "all", paymentRegion.country, paymentRegion.currency],
    queryFn: () => paymentMethods(paymentRegion.country, paymentRegion.currency, true),
    enabled: Boolean(session.token && paymentsExpanded)
  });
  const cards = useQuery({ queryKey: ["member-cards"], queryFn: memberCards, enabled: Boolean(session.token) });
  const activeCard = selectEligibleMemberCard(cards.data ?? []);

  async function openLegalPage(page: "privacy" | "privacy-choices" | "terms") {
    const url = legalUrl(page);
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  function confirmMembershipCancellation() {
    if (!activeCard) return;
    Alert.alert(t("cancelMembership"), t("cancelMembershipConfirm"), [
      { text: t("keepMembership"), style: "cancel" },
      {
        text: t("submitRequest"),
        style: "destructive",
        onPress: () => void requestMembershipCancellation(activeCard.id)
          .then(() => cards.refetch())
          .then(() => Alert.alert(t("requestSubmitted"), t("cancellationRequestSubmitted")))
          .catch((error) => Alert.alert(t("requestFailed"), localizedApiError(error, t)))
      }
    ]);
  }

  function confirmAccountDeletion() {
    Alert.alert(t("deleteAccount"), t("deleteAccountConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteAccount"),
        style: "destructive",
        onPress: () => void deleteAccount()
          .then(() => session.logout())
          .catch((error) => Alert.alert(t("requestFailed"), localizedApiError(error, t)))
      }
    ]);
  }

  return (
    <Screen title={t("profileTab")} eyebrow={t("studentStudio")}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}><Ionicons name="person" size={24} style={styles.accountIconGlyph} /></View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountName}>{session.user?.name ?? "Yogi"}</Text>
            <Text style={styles.accountMeta}>{session.user?.email ?? session.user?.phone ?? ""}</Text>
          </View>
        </View>

        <View style={styles.disclosure}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: paymentsExpanded }}
            onPress={() => setPaymentsExpanded((value) => !value)}
            style={styles.disclosureHeader}
          >
            <View style={styles.disclosureCopy}>
              <Text style={styles.disclosureTitle}>{t("paymentMethods")}</Text>
              <Text style={styles.disclosureMeta}>{t("allPaymentMethods")}</Text>
            </View>
            <Ionicons name={paymentsExpanded ? "chevron-up" : "chevron-down"} size={22} style={styles.chevron} />
          </Pressable>
          {paymentsExpanded ? (
            <View style={styles.disclosureBody}>
              {methods.isLoading ? (
                <ActivityIndicator color={styles.loading.color} />
              ) : methods.error ? (
                <QueryErrorNotice title={t("paymentMethodsErrorTitle")} message={t("queryErrorMessage")} onRetry={() => void methods.refetch()} />
              ) : (
                <PaymentMethodsGrid methods={methods.data ?? []} locale={session.locale} />
              )}
            </View>
          ) : null}
        </View>

        <SectionHeader title={t("privacyAndAccount")} meta={t("californiaPrivacyMeta")} />
        <View style={styles.actionsCard}>
          <GhostButton title={t("privacyPolicy")} onPress={() => void openLegalPage("privacy")} />
          <GhostButton title={t("californiaPrivacyChoices")} onPress={() => void openLegalPage("privacy-choices")} />
          <GhostButton title={t("membershipTerms")} onPress={() => void openLegalPage("terms")} />
          <GhostButton title={t("requestDataCopy")} onPress={() => void exportPrivacyData().then(() => createPrivacyRequest("access")).then(() => Alert.alert(t("requestSubmitted"), t("dataRequestSubmitted"))).catch((error) => Alert.alert(t("requestFailed"), localizedApiError(error, t)))} />
          {activeCard ? <GhostButton title={t("cancelMembership")} onPress={confirmMembershipCancellation} /> : null}
          <GhostButton title={t("deleteAccount")} onPress={confirmAccountDeletion} />
          <GhostButton title={t("logout")} onPress={() => void session.logout()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
    accountCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderCurve: "continuous" },
    accountIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.accentSoft },
    accountIconGlyph: { color: colors.accentDark },
    accountCopy: { flex: 1, gap: 3 },
    accountName: { color: colors.text, fontSize: 20, fontWeight: "800" },
    accountMeta: { color: colors.muted, fontSize: 13 },
    disclosure: { overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderCurve: "continuous" },
    disclosureHeader: { minHeight: 78, padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    disclosureCopy: { flex: 1, gap: 4 },
    disclosureTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    disclosureMeta: { color: colors.muted, fontSize: 12 },
    chevron: { color: colors.muted },
    disclosureBody: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
    loading: { color: colors.accentDark },
    actionsCard: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, borderCurve: "continuous" }
  });
}
