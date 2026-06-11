export type Role = "student" | "coach" | "staff" | "admin";

export type LocalizedText = {
  en?: string;
  "zh-Hans"?: string;
  ko?: string;
};

export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  locale: string;
  roles: Role[];
};

export type Session = {
  id: string;
  userId: string;
  activeRole: Role;
  locale: string;
  expiresAt: string;
};

export type LoginResponse = {
  token: string;
  session: Session;
  user: User;
};

export type Course = {
  id: string;
  title: string | LocalizedText;
  description?: string | LocalizedText;
  durationMinutes?: number;
  priceAmount: number;
  currency: string;
  capacity: number;
  memberCardDeductCount: number;
  active?: boolean;
};

export type Coach = {
  id: string;
  userId: string;
  name: string;
  age?: number;
  yearsOfExperience?: number;
  tags?: string[];
  bio?: string | LocalizedText;
};

export type AvailabilitySession = {
  id: string;
  courseId: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  course?: Course;
  coach?: Coach;
  participants?: Participant[];
  participantCount?: number;
};

export type Participant = {
  id: string;
  bookingId: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  color: string;
  status: string;
};

export type Booking = {
  id: string;
  userId: string;
  courseId: string;
  courseSessionId: string;
  coachId: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "checked_in";
  startsAt: string;
  endsAt: string;
  course?: Course;
  coach?: Coach;
  user?: User;
};

export type MemberCard = {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "frozen" | "expired" | "transferred" | "upgraded";
  totalCredits: number;
  remainingCredits: number;
  expiresAt: string;
};

export type Order = {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  currency: string;
  paymentId?: string;
};

export type Payment = {
  id: string;
  orderId?: string;
  userId: string;
  paymentProvider: "stripe" | "antom";
  paymentMethodFamily: "card" | "wallet" | "local_wallet";
  paymentMethodCode: string;
  amount: number;
  currency: string;
  country: string;
  status: string;
  refundStatus: string;
};

export type PaymentMethod = {
  code: string;
  family: string;
  flow: "native_or_checkout" | "redirect" | "checkout_redirect";
  recurring: boolean;
  display: Record<string, string>;
};

export type AdminDashboard = {
  metrics: Record<string, number>;
  todaySessions: AvailabilitySession[];
  pending: Record<string, number>;
};

export type AdminMember = User & {
  memberCards: MemberCard[];
  bookings: Booking[];
  orders: Order[];
  reviews: unknown[];
  bodyMetrics: unknown[];
};

export type AuditLog = {
  id: string;
  actorUserId: string;
  actorRole: Role;
  action: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
};
