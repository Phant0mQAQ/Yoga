import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StudentClassCard } from "@/components/student-class-card";
import {
  Loading,
  QueryErrorNotice,
  Screen,
  SectionHeader
} from "@/components/ui";
import { useStudentBooking } from "@/hooks/use-student-booking";
import { useSession } from "@/state/session";
import { useThemedStyles } from "@/state/theme";
import { spacing } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import {
  isSessionBookable,
  selectEligibleMemberCard
} from "@/utils/booking";

export default function StudentBookingsScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const styles = useThemedStyles(createStyles);
  const {
    bookingClassId,
    bookingHistory,
    bookClass,
    cards,
    classes,
    pendingBookings,
    refreshBookings
  } = useStudentBooking();

  if (classes.isLoading || cards.isLoading || bookingHistory.isLoading) return <Loading />;

  const refreshing = classes.isRefetching || cards.isRefetching || bookingHistory.isRefetching;
  const visibleClasses = (classes.data ?? []).filter((item) => (
    isSessionBookable(item) || pendingBookings.has(item.id)
  ));

  return (
    <Screen title={t("bookings")} eyebrow={t("studentStudio")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scroll}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshBookings()}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        {classes.error || cards.error || bookingHistory.error ? (
          <QueryErrorNotice
            title={t("studentDataErrorTitle")}
            message={t("queryErrorMessage")}
            onRetry={() => void refreshBookings()}
          />
        ) : (
          <>
            <SectionHeader title={t("upcomingClasses")} meta={t("classSocialMeta")} />
            <View style={styles.classList}>
              {visibleClasses.length ? visibleClasses.map((item, index) => {
                const pendingBooking = pendingBookings.get(item.id);
                return (
                  <StudentClassCard
                    key={item.id}
                    item={item}
                    locale={session.locale}
                    featured={index === 0}
                    booking={bookingClassId === item.id}
                    disabled={bookingClassId !== null}
                    pendingPayment={Boolean(pendingBooking)}
                    requiresPayment={Boolean(pendingBooking) || !selectEligibleMemberCard(
                      cards.data ?? [],
                      item.course?.memberCardDeductCount ?? 1
                    )}
                    onBook={() => bookClass(item)}
                  />
                );
              }) : (
                <Text selectable style={styles.emptyText}>{t("noScheduledClasses")}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.lg
    },
    classList: {
      gap: spacing.md
    },
    emptyText: {
      color: colors.muted,
      paddingVertical: spacing.xl,
      textAlign: "center"
    }
  });
}
