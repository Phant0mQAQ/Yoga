type ApiLikeError = {
  code?: string;
  status?: number;
};

type Translate = (key: string) => string;

const ERROR_KEYS: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  role_not_allowed: "roleNotAllowed",
  session_full: "classFull",
  session_closed: "bookingUnavailable",
  session_started: "bookingUnavailable",
  duplicate_booking: "bookingUnavailable",
  no_active_card: "membershipUnavailable",
  insufficient_credits: "membershipUnavailable",
  order_not_payable: "paymentUnavailable",
  order_payment_in_progress: "paymentUnavailable",
  not_checkin_eligible: "checkInUnavailable",
  checkin_too_early: "checkInUnavailable",
  checkin_window_closed: "checkInUnavailable",
  coach_booking_forbidden: "checkInUnavailable",
  payment_not_refundable: "refundUnavailable",
  payment_already_refunded: "refundUnavailable",
  refund_amount_exceeds_remaining: "invalidRefundAmount",
  invalid_refund_amount: "invalidRefundAmount",
  network_error: "networkError"
};

export function apiErrorTranslationKey(error: unknown) {
  if (!error || typeof error !== "object") return "requestFailed";
  const candidate = error as ApiLikeError;
  if (candidate.code && ERROR_KEYS[candidate.code]) return ERROR_KEYS[candidate.code];
  if (candidate.status === 0) return "networkError";
  return "requestFailed";
}

export function localizedApiError(error: unknown, t: Translate) {
  return t(apiErrorTranslationKey(error));
}
