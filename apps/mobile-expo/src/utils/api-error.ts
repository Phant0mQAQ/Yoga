type ApiLikeError = {
  code?: string;
  status?: number;
};

type Translate = (key: string) => string;

const ERROR_KEYS: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  role_not_allowed: "roleNotAllowed",
  role_registration_restricted: "roleRegistrationRestricted",
  invalid_coach_invite_code: "invalidCoachInviteCode",
  coach_registration_not_configured: "coachRegistrationUnavailable",
  email_already_in_use: "emailAlreadyInUse",
  invalid_email: "invalidEmail",
  email_not_verified: "emailNotVerified",
  invalid_verification_code: "invalidVerificationCode",
  verification_code_expired: "verificationCodeExpired",
  verification_attempts_exceeded: "verificationAttemptsExceeded",
  verification_code_cooldown: "verificationCodeCooldown",
  email_delivery_failed: "emailDeliveryFailed",
  email_service_not_configured: "emailServiceUnavailable",
  firebase_auth_not_configured: "emailServiceUnavailable",
  firebase_auth_unavailable: "emailServiceUnavailable",
  firebase_auth_timeout: "emailServiceUnavailable",
  firebase_auth_failed: "requestFailed",
  firebase_password_auth_disabled: "emailServiceUnavailable",
  firebase_auth_quota_exceeded: "emailServiceUnavailable",
  too_many_auth_attempts: "verificationCodeCooldown",
  account_disabled: "invalidCredentials",
  account_not_linked: "invalidCredentials",
  invalid_name: "invalidName",
  weak_password: "weakPassword",
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
  invalid_avatar_type: "invalidAvatarType",
  avatar_too_large: "avatarTooLarge",
  avatar_upload_incomplete: "uploadFailedMessage",
  storage_not_configured: "uploadFailedMessage",
  storage_unavailable: "uploadFailedMessage",
  storage_error: "uploadFailedMessage",
  request_timeout: "requestTimedOut",
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
