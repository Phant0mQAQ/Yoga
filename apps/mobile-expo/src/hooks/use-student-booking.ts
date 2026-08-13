import { useQuery } from "@tanstack/react-query";
import { getLocales } from "expo-localization";
import * as Linking from "expo-linking";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import {
  availability,
  bookings as listBookings,
  createBooking,
  createCheckoutSession,
  memberCards,
  order as getOrder,
  paymentMethods
} from "@/api/client";
import type { AvailabilitySession, Order } from "@/api/types";
import { useSession } from "@/state/session";
import {
  apiErrorTranslationKey,
  localizedApiError
} from "@/utils/api-error";
import {
  pendingBookingsBySession,
  resolveCheckoutPaymentRegion,
  selectEligibleMemberCard
} from "@/utils/booking";

export function useStudentBooking() {
  const { t } = useTranslation();
  const session = useSession();
  const bookingRequestInFlight = useRef(false);
  const [bookingClassId, setBookingClassId] = useState<string | null>(null);
  const deviceRegionCode = getLocales()[0]?.regionCode;

  const classes = useQuery({
    queryKey: ["availability", session.locale],
    queryFn: () => availability(session.locale),
    enabled: Boolean(session.token),
    refetchInterval: 30_000
  });
  const cards = useQuery({
    queryKey: ["member-cards"],
    queryFn: memberCards,
    enabled: Boolean(session.token)
  });
  const bookingHistory = useQuery({
    queryKey: ["bookings", "student", session.locale],
    queryFn: () => listBookings(session.locale),
    enabled: Boolean(session.token),
    refetchInterval: 30_000
  });

  const pendingBookings = pendingBookingsBySession(bookingHistory.data ?? []);

  function refreshBookings() {
    return Promise.all([
      classes.refetch(),
      cards.refetch(),
      bookingHistory.refetch()
    ]);
  }

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

  return {
    bookingClassId,
    bookingHistory,
    bookClass,
    cards,
    classes,
    pendingBookings,
    refreshBookings
  };
}

function studentErrorMessage(error: unknown, t: TFunction) {
  if (error instanceof Error && [
    t("checkoutUnavailable"),
    t("unableToLoadBookings")
  ].includes(error.message)) {
    return error.message;
  }
  return localizedApiError(error, t);
}
