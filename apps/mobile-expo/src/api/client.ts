import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { z } from "zod";
import type {
  AdminDashboard,
  AdminMember,
  AuditLog,
  AvailabilitySession,
  Booking,
  LoginResponse,
  MemberCard,
  Order,
  Payment,
  PaymentMethod,
  Role,
  User
} from "./types";

const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
export const API_BASE_URL = resolveApiBaseUrl();

let authToken: string | null = null;
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

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export async function login(email: string, password: string, role: Role, locale: string) {
  const response = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password, role, locale }
  });
  const schema = z.object({
    token: z.string(),
    session: z.object({ activeRole: z.enum(["student", "coach", "staff", "admin"]) }),
    user: z.object({ id: z.string(), name: z.string() })
  }).passthrough();
  schema.parse(response);
  return response;
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

export async function home(locale: string) {
  return request(`/home?locale=${encodeURIComponent(locale)}`);
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

export async function createBooking(courseSessionId: string, paymentMode: "member_card" | "payment") {
  return request<{ booking: Booking; order?: Order }>("/bookings", {
    method: "POST",
    idempotencyKey: idempotencyKey(),
    body: { courseSessionId, paymentMode }
  });
}

export async function checkIn(bookingId: string) {
  return request(`/bookings/${bookingId}/check-in`, {
    method: "POST",
    body: { method: "manual" }
  });
}

export async function paymentMethods(country: string, currency: string) {
  return request<PaymentMethod[]>(`/payments/methods?country=${country}&currency=${currency}`);
}

export async function createPaymentSheet(input: {
  orderId?: string;
  amount?: number;
  currency: string;
  country: string;
  methodCode: string;
}) {
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
    body: input
  });
}

export async function createCheckoutSession(input: {
  orderId?: string;
  amount?: number;
  currency: string;
  country: string;
  methodCode: string;
}) {
  return request<{ stripe: { url?: string } }>("/payments/stripe/checkout-sessions", {
    method: "POST",
    body: {
      ...input,
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
  presignUpload: (body: unknown) => adminWrite("/admin/uploads/presign", "POST", body)
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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  skipUnauthorizedHandler?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error(`Cannot reach the Yomi Yoga API at ${API_BASE_URL}. Check that the API server is running and your iPhone can access this address.`);
  }
  const rawBody = await response.text();
  let data: Record<string, unknown> = {};
  if (rawBody) {
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      data = { message: rawBody };
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
    return `http://${metroHost}:8090/api/v1`;
  }

  if (configuredBaseUrl) return normalizeBaseUrl(configuredBaseUrl);
  if (__DEV__) return "http://localhost:8090/api/v1";
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
