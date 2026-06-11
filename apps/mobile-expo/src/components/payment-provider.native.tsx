import { StripeProvider } from "@stripe/stripe-react-native";
import type { ReactElement } from "react";

export function PaymentProvider({ children }: { children: ReactElement }) {
  return (
    <StripeProvider
      publishableKey="pk_test_mock"
      merchantIdentifier="merchant.com.yourcompany.yogabooking"
    >
      {children}
    </StripeProvider>
  );
}
