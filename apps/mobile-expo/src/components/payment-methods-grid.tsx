import { Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import type { PaymentMethod } from "@/api/types";
import { useThemedStyles } from "@/state/theme";
import { radius, spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";

const METHOD_LOGOS: Record<string, ImageSourcePropType> = {
  card: require("../../assets/payment/card.png"),
  apple_pay: require("../../assets/payment/apple-pay.png"),
  google_pay: require("../../assets/payment/google-pay.png"),
  paypal: require("../../assets/payment/paypal.png"),
  alipay: require("../../assets/payment/alipay.png"),
  wechat_pay: require("../../assets/payment/wechat-pay.png"),
  kakao_pay: require("../../assets/payment/kakao-pay.png"),
  naver_pay: require("../../assets/payment/naver-pay.png"),
  samsung_pay: require("../../assets/payment/samsung-pay.png"),
  payco: require("../../assets/payment/payco.png")
};

const CARD_NETWORKS = [
  ["Visa", require("../../assets/payment/visa.png")],
  ["Mastercard", require("../../assets/payment/mastercard.png")],
  ["American Express", require("../../assets/payment/american-express.png")],
  ["Discover", require("../../assets/payment/discover.png")],
  ["JCB", require("../../assets/payment/jcb.png")],
  ["Diners Club", require("../../assets/payment/diners-club.png")],
  ["UnionPay", require("../../assets/payment/unionpay.png")]
] as const;

export function PaymentMethodsGrid({ methods, locale }: { methods: PaymentMethod[]; locale: string }) {
  const styles = useThemedStyles(createStyles);
  const displayMethods = paymentMethodsForDisplay(methods);

  return (
    <View style={styles.grid}>
      {displayMethods.map((method) => {
        const isCard = method.code === "card";
        const labelLocale = locale === "zh-Hans" ? "zh" : locale;
        const label = method.display?.[labelLocale] ?? method.display?.en ?? method.code;
        return (
          <View key={method.code} accessibilityLabel={label} style={[styles.method, isCard && styles.cardMethod]}>
            <View style={styles.heading}>
              <PaymentMethodLogo code={method.code} />
              <Text numberOfLines={2} selectable style={styles.methodName}>{label}</Text>
            </View>
            {isCard ? <CardNetworkLogos /> : null}
          </View>
        );
      })}
    </View>
  );
}

function PaymentMethodLogo({ code }: { code: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.logoFrame} accessibilityElementsHidden>
      <Image source={METHOD_LOGOS[code] ?? METHOD_LOGOS.card} style={styles.logoImage} resizeMode="contain" />
    </View>
  );
}

function paymentMethodsForDisplay(methods: PaymentMethod[]) {
  const wallets = ([
    {
      code: "apple_pay",
      family: "wallet",
      flow: "native_or_checkout",
      recurring: true,
      display: { en: "Apple Pay", zh: "Apple Pay", "zh-Hans": "Apple Pay", ko: "Apple Pay" }
    },
    {
      code: "google_pay",
      family: "wallet",
      flow: "native_or_checkout",
      recurring: true,
      display: { en: "Google Pay", zh: "Google Pay", "zh-Hans": "Google Pay", ko: "Google Pay" }
    }
  ] satisfies PaymentMethod[]).filter((wallet) => !methods.some((method) => method.code === wallet.code));
  const result = [...methods];
  const cardIndex = methods.findIndex((method) => method.code === "card");
  result.splice(cardIndex < 0 ? 0 : cardIndex + 1, 0, ...wallets);
  return result;
}

function CardNetworkLogos() {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      accessible
      accessibilityLabel="Accepted card networks: Visa, Mastercard, American Express, Discover, JCB, Diners Club, UnionPay"
      style={styles.networkGrid}
    >
      {CARD_NETWORKS.map(([name, source]) => (
        <View key={name} accessibilityLabel={name} style={styles.networkLogo}>
          <Image source={source} style={styles.networkImage} resizeMode="contain" />
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    method: {
      width: "48.7%",
      minHeight: 92,
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.lg,
      borderCurve: "continuous",
      padding: spacing.md
    },
    cardMethod: { width: "100%", minHeight: 144, justifyContent: "space-between" },
    heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    methodName: { flex: 1, color: colors.text, fontWeight: "800", fontSize: 14, lineHeight: 18 },
    logoFrame: {
      width: 52,
      height: 44,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E5E7E5",
      borderRadius: 9,
      borderCurve: "continuous"
    },
    logoImage: { width: "100%", height: "100%" },
    networkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5, paddingTop: spacing.md },
    networkLogo: {
      width: "23.5%",
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#DFE3E8",
      borderRadius: 6,
      borderCurve: "continuous"
    },
    networkImage: { width: "100%", height: "100%" }
  });
}
