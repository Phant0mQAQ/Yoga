import type { Booking, MemberCard } from "@/api/types";

type UsableCard = Pick<MemberCard, "status" | "expiresAt" | "remainingCredits">;
type PendingBooking = Pick<Booking, "status" | "courseSessionId">;

export type PaymentRegion = {
  country: string;
  currency: string;
};

const CURRENCY_BY_REGION: Record<string, string> = {
  AT: "EUR",
  AU: "AUD",
  BE: "EUR",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  CZ: "CZK",
  DE: "EUR",
  DK: "DKK",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GB: "GBP",
  GR: "EUR",
  HK: "HKD",
  IE: "EUR",
  IT: "EUR",
  JP: "JPY",
  KR: "KRW",
  LU: "EUR",
  MO: "MOP",
  MY: "MYR",
  NL: "EUR",
  NO: "NOK",
  NZ: "NZD",
  PL: "PLN",
  PT: "EUR",
  SE: "SEK",
  SG: "SGD",
  TW: "TWD",
  US: "USD"
};

export function selectEligibleMemberCard<T extends UsableCard>(
  cards: readonly T[],
  requiredCredits = 0,
  now: number | Date = Date.now()
): T | undefined {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const minimumCredits = Number.isFinite(requiredCredits) ? Math.max(0, requiredCredits) : 0;

  return cards.reduce<T | undefined>((selected, card) => {
    const expiresAt = Date.parse(card.expiresAt);
    const eligible = card.status === "active"
      && Number.isFinite(expiresAt)
      && expiresAt > nowMs
      && card.remainingCredits >= minimumCredits;

    if (!eligible) return selected;
    if (!selected) return card;
    return expiresAt < Date.parse(selected.expiresAt) ? card : selected;
  }, undefined);
}

export function resolvePaymentRegion(regionCode?: string | null): PaymentRegion {
  const normalized = regionCode?.trim().toUpperCase();
  const country = normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : "HK";
  return {
    country,
    currency: CURRENCY_BY_REGION[country] ?? "USD"
  };
}

export function resolveCheckoutPaymentRegion(
  regionCode: string | null | undefined,
  orderCurrency: string | null | undefined
): PaymentRegion {
  const deviceRegion = resolvePaymentRegion(regionCode);
  const normalizedCurrency = orderCurrency?.trim().toUpperCase();
  return {
    country: deviceRegion.country,
    currency: normalizedCurrency && /^[A-Z]{3}$/.test(normalizedCurrency)
      ? normalizedCurrency
      : deviceRegion.currency
  };
}

export function pendingBookingsBySession<T extends PendingBooking>(rows: readonly T[]) {
  const result = new Map<string, T>();
  for (const booking of rows) {
    if (booking.status === "pending_payment" && !result.has(booking.courseSessionId)) {
      result.set(booking.courseSessionId, booking);
    }
  }
  return result;
}

export function parseBookingIdFromQr(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 4096) return null;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const fromJson = bookingIdFromJson(parsed);
      if (fromJson) return fromJson;
    } catch {
      return null;
    }
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(text) || text.startsWith("/")) {
    try {
      const url = new URL(text, "https://good-vibe.invalid");
      for (const key of ["bookingId", "booking_id"]) {
        const candidate = normalizeBookingId(url.searchParams.get(key));
        if (candidate) return candidate;
      }

      const segments = url.pathname.split("/").filter(Boolean).map(safeDecodeURIComponent);
      const hostIsMarker = ["booking", "bookings", "check-in", "checkin"].includes(url.hostname.toLowerCase());
      const hostCandidate = hostIsMarker ? normalizeBookingId(segments[0]) : null;
      if (hostCandidate) return hostCandidate;

      const markerIndex = segments.findIndex((segment) => segment === "bookings" || segment === "booking");
      const markedCandidate = markerIndex >= 0 ? normalizeBookingId(segments[markerIndex + 1]) : null;
      if (markedCandidate) return markedCandidate;

      const checkInIndex = segments.findIndex((segment) => segment === "check-in" || segment === "checkin");
      const checkInCandidate = checkInIndex >= 0 ? normalizeBookingId(segments[checkInIndex + 1]) : null;
      if (checkInCandidate) return checkInCandidate;

      if (hostIsMarker || markerIndex >= 0 || checkInIndex >= 0) {
        const idCandidate = normalizeBookingId(url.searchParams.get("id"));
        if (idCandidate) return idCandidate;
      }
    } catch {
      return null;
    }
  }

  return normalizeBookingId(text);
}

function bookingIdFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  for (const key of ["bookingId", "booking_id", "id"]) {
    const candidate = normalizeBookingId(record[key]);
    if (candidate) return candidate;
  }

  const nestedBooking = bookingIdFromJson(record.booking);
  if (nestedBooking) return nestedBooking;
  return typeof record.url === "string" ? parseBookingIdFromQr(record.url) : null;
}

function normalizeBookingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/.test(candidate) ? candidate : null;
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
