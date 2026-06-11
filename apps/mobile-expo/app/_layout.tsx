import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import { useEffect, useMemo } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/i18n";
import { isUnauthorizedError } from "@/api/client";
import { Loading } from "@/components/ui";
import { PaymentProvider } from "@/components/payment-provider";
import { SessionProvider } from "@/state/session";
import { useSession } from "@/state/session";
import { ThemeProvider } from "@/state/theme";

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 1
      }
    }
  }), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaymentProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <SessionNavigator />
            </SessionProvider>
          </QueryClientProvider>
        </PaymentProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function SessionNavigator() {
  const session = useSession();
  const segments = useSegments();
  const currentGroup = segments[0];
  const targetGroup = session.role ? `(${session.role})` : "(auth)";

  useEffect(() => {
    if (!session.ready) return;

    if (currentGroup !== targetGroup) {
      router.replace(routeForRole(session.role));
    }
  }, [currentGroup, session.ready, session.role, targetGroup]);

  if (!session.ready) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(student)" />
      <Stack.Screen name="(coach)" />
      <Stack.Screen name="(staff)" />
      <Stack.Screen name="(admin)" />
    </Stack>
  );
}

function routeForRole(role: ReturnType<typeof useSession>["role"]) {
  if (role === "student") return "/(student)" as const;
  if (role === "coach") return "/(coach)" as const;
  if (role === "staff") return "/(staff)" as const;
  if (role === "admin") return "/(admin)" as const;
  return "/(auth)" as const;
}
