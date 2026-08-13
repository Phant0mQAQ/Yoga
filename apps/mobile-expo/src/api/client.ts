import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { z } from "zod";
import type {
  AdminDashboard,
  AdminMember,
  AuditLog,
  AvailabilitySession,
  Booking,
  Home,
  LoginResponse,
  MemberCard,
  Order,
  Payment,
  PaymentMethod,
  PresignedUpload,
  PrivacyRequest,
  RegistrationStartResponse,
  Role,
  User
} from "./types";

const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
export const API_BASE_URL = resolveApiBaseUrl();

let authToken: string | null = null;
let firebaseRefreshToken: string | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setFirebaseRefreshToken(token: string | null) {
  firebaseRefreshToken = token;
}

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

const authResponseSchema = z.object({
  token: z.string(),
  session: z.object({ activeRole: z.enum(["student", "coach", "staff", "admin"]) }),
  user: z.object({ id: z.string(), name: z.string() })
}).passthrough();

export async function login(email: string, password: string, role: Role, locale: string) {
  const response = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password, role, locale },
    timeoutMs: 20_000
  });
  authResponseSchema.parse(response);
  return response;
}

export async function register(
  name: string,
  email: string,
  password: string,
  role: Role,
  locale: string,
  inviteCode?: string
) {
  const response = await request<RegistrationStartResponse>("/auth/register", {
    method: "POST",
    body: { name, email, password, role, locale, ...(inviteCode ? { inviteCode } : {}) },
    timeoutMs: 30_000
  });
  z.object({
    requiresVerification: z.literal(true),
    email: z.string().email(),
    verificationMethod: z.enum(["link", "code"]).optional(),
    expiresAt: z.string().optional()
  }).parse(response);
  return response;
}

export async function resendEmailVerification(email: string, password: string, locale: string) {
  return request<RegistrationStartResponse>("/auth/email/resend", {
    method: "POST",
    body: { email, password, locale },
    timeoutMs: 20_000
  });
}

export async function logout() {
  if (!authToken) return { ok: true };
  return request<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    skipUnauthorizedHandler: true
  });
}

export async function me() {
  return request<{ user: User; activeRole: Role; sessionId: string }>("/me");
}

export async function presignAvatarUpload(body: { fileName: string; contentType: string; fileSize?: number }) {
  return request<PresignedUpload>("/me/avatar-upload", {
    method: "POST",
    body
  });
}

export async function uploadAvatarFile(upload: PresignedUpload, contentType: string, body: Blob) {
  return uploadPresignedFile(upload, contentType, body, "Avatar");
}

export async function uploadAdminFile(upload: PresignedUpload, contentType: string, body: Blob) {
  return uploadPresignedFile(upload, contentType, body, "Admin media");
}

async function uploadPresignedFile(upload: PresignedUpload, contentType: string, body: Blob, label: string) {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    ...upload.headers
  };
  if (isFirstPartyUploadUrl(upload.uploadUrl) && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers,
    body
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new ApiError(
      failure.message ?? `${label} upload failed with status ${response.status}`,
      response.status,
      failure.error ?? "upload_failed"
    );
  }
}

export async function saveAvatar(objectKey: string) {
  return request<User>("/me/avatar", {
    method: "PATCH",
    body: { objectKey }
  });
}

function isFirstPartyUploadUrl(value: string) {
  try {
    return new URL(value).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
}

export async function home(locale: string) {
  return request<Home>(`/home?locale=${encodeURIComponent(locale)}`);
}

export async function availability(locale: string) {
  return request<AvailabilitySession[]>(`/availability?locale=${encodeURIComponent(locale)}`);
}

export async function bookings(locale: string) {
  return request<Booking[]>(`/bookings?locale=${encodeURIComponent(locale)}`);
}

export async function memberCards() {
  return request<MemberCard[]>("/member-cards");
}

export function legalUrl(page: "privacy" | "privacy-choices" | "terms") {
  return `${API_BASE_URL.replace(/\/api\/v1\/?$/, "")}/${page}`;
}

export async function requestMembershipCancellation(cardId: string, reason = "user_request") {
  return request(`/member-cards/${encodeURIComponent(cardId)}/cancel-request`, {
    method: "POST",
    body: { reason }
  });
}

export async function createPrivacyRequest(type: PrivacyRequest["type"], details = "") {
  return request<PrivacyRequest>("/privacy/requests", { method: "POST", body: { type, details } });
}

export async function exportPrivacyData() {
  return request<Record<string, unknown>>("/privacy/export");
}

export async function deleteAccount() {
  return request<{ ok: boolean; completedAt: string }>("/privacy/account-deletion", {
    method: "POST",
    body: firebaseRefreshToken ? { firebaseRefreshToken } : {},
    skipUnauthorizedHandler: true
  });
}

export async function createBooking(courseSessionId: string, paymentMode: "member_card" | "payment") {
  return request<{ booking: Booking; order?: Order }>("/bookings", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: { courseSessionId, paymentMode }
  });
}

export async function order(orderId: string) {
  return request<Order>(`/orders/${encodeURIComponent(orderId)}`);
}

export async function checkIn(bookingId: string, method: "manual" | "qr" = "manual") {
  return request(`/bookings/${bookingId}/check-in`, {
    method: "POST",
    body: { method }
  });
}

export async function paymentMethods(country: string, currency: string, allSupported = false) {
  const scope = allSupported ? "&scope=all" : "";
  return request<PaymentMethod[]>(`/payments/methods?country=${country}&currency=${currency}${scope}`);
}

export async function createPaymentSheet(input: {
  orderId?: string;
  amount?: number;
  currency: string;
  country: string;
  methodCode: string;
  idempotencyKey?: string;
}) {
  const { idempotencyKey: attemptKey, ...body } = input;
  return request<{
    payment: Payment;
    stripe: {
      paymentIntentClientSecret: string;
      customerId?: string | null;
      ephemeralKeySecret?: string | null;
      publishableKey: string;
      merchantIdentifier: string;
    };
  }>("/payments/stripe/payment-sheet", {
    method: "POST",
    idempotencyKey: attemptKey ?? paymentIdempotencyKey("payment-sheet", input.orderId),
    body
  });
}

export async function createCheckoutSession(input: {
  orderId?: string;
  amount?: number;
  currency: string;
  country: string;
  methodCode: string;
  locale?: string;
  idempotencyKey?: string;
}) {
  const { idempotencyKey: attemptKey, ...body } = input;
  return request<{ stripe: { url?: string } }>("/payments/stripe/checkout-sessions", {
    method: "POST",
    idempotencyKey: attemptKey ?? paymentIdempotencyKey("checkout", input.orderId),
    body: {
      ...body,
      successUrl: Linking.createURL("/payment-return?status=success"),
      cancelUrl: Linking.createURL("/payment-return?status=cancel")
    }
  });
}

export const adminApi = {
  dashboard: () => request<AdminDashboard>("/admin/dashboard"),
  members: () => request<AdminMember[]>("/admin/members"),
  member: (id: string) => request<AdminMember>(`/admin/members/${id}`),
  updateMember: (id: string, body: Partial<User>) => adminWrite<AdminMember>(`/admin/members/${id}`, "PATCH", body),
  memberCards: () => request<MemberCard[]>("/admin/member-cards"),
  freezeCard: (id: string, body: unknown) => adminWrite(`/admin/member-cards/${id}/freeze`, "POST", body),
  extendCard: (id: string, body: unknown) => adminWrite(`/admin/member-cards/${id}/extend`, "POST", body),
  transferCard: (id: string, body: unknown) => adminWrite(`/admin/member-cards/${id}/transfer`, "POST", body),
  upgradeCard: (id: string, body: unknown) => adminWrite(`/admin/member-cards/${id}/upgrade`, "POST", body),
  resource: <T>(resource: string) => request<T[]>(`/admin/${resource}`),
  createResource: <T>(resource: string, body: unknown) => adminWrite<T>(`/admin/${resource}`, "POST", body),
  updateResource: <T>(resource: string, id: string, body: unknown) => adminWrite<T>(`/admin/${resource}/${id}`, "PATCH", body),
  deleteResource: <T>(resource: string, id: string) => adminWrite<T>(`/admin/${resource}/${id}`, "DELETE", {}),
  orders: () => request<Order[]>("/admin/orders"),
  payments: () => request<Payment[]>("/admin/payments"),
  refund: (paymentId: string, body: unknown) => adminWrite(`/admin/payments/${paymentId}/refunds`, "POST", body),
  auditLogs: () => request<AuditLog[]>("/admin/audit-logs"),
  presignUpload: (body: { scope: string; fileName: string; contentType?: string; fileSize?: number }) => (
    adminWrite<PresignedUpload>("/admin/uploads/presign", "POST", body)
  )
};

async function adminWrite<T>(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
  return request<T>(path, {
    method,
    idempotencyKey: idempotencyKey(),
    body
  });
}

function idempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function paymentIdempotencyKey(flow: "payment-intent" | "payment-sheet" | "checkout", orderId?: string) {
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  return orderId
    ? `mobile-payment-${flow}-${orderId}-${hourBucket}`
    : `mobile-payment-${flow}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  skipUnauthorizedHandler?: boolean;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  let response: Response;
  let rawBody: string;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    rawBody = await response.text();
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("Request timed out", 0, "request_timeout");
    }
    throw new ApiError("Network request failed", 0, "network_error");
  } finally {
    clearTimeout(timeout);
  }
  let data: Record<string, unknown> = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new ApiError("Request failed", response.status, "invalid_response");
    }
  }
  if (!response.ok) {
    const error = new ApiError(
      String(data.message ?? data.error ?? "Request failed"),
      response.status,
      typeof data.error === "string" ? data.error : undefined
    );
    if (response.status === 401 && !options.skipUnauthorizedHandler) {
      await unauthorizedHandler?.();
    }
    throw error;
  }
  return data as T;
}

function resolveApiBaseUrl() {
  const environmentUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (environmentUrl) return normalizeBaseUrl(environmentUrl);

  const metroHost = hostFromUri(Constants.expoConfig?.hostUri);
  if (__DEV__ && metroHost && isLocalNetworkHost(metroHost)) {
    return `http://${metroHost}:8080/api/v1`;
  }

  if (configuredBaseUrl) return normalizeBaseUrl(configuredBaseUrl);
  if (__DEV__) return "http://localhost:8080/api/v1";
  throw new Error("EXPO_PUBLIC_API_BASE_URL must be configured for production builds");
}

function hostFromUri(value?: string) {
  if (!value) return null;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return value.split(":")[0] || null;
  }
}

function isLocalNetworkHost(host: string) {
  return host === "localhost"
    || host === "127.0.0.1"
    || host.startsWith("10.")
    || host.startsWith("192.168.")
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}
