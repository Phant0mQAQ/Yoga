import { StripeProvider } from "@stripe/stripe-react-native";
import type { ReactElement } from "react";

const publishableKey = publicSetting(
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "pk_test_mock"
);
const merchantIdentifier = publicSetting(
  process.env.EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER,
  "EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER",
  "merchant.com.goodvibe.pilatesyoga"
);

export function PaymentProvider({ children }: { children: ReactElement }) {
  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
    >
      {children}
    </StripeProvider>
  );
}

function publicSetting(value: string | undefined, name: string, developmentFallback: string) {
  if (value?.trim()) return value.trim();
  if (__DEV__) return developmentFallback;
  throw new Error(`${name} must be configured for production builds`);
}
