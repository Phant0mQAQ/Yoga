CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('student', 'coach', 'staff', 'admin');
CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'checked_in');
CREATE TYPE member_card_status AS ENUM ('active', 'frozen', 'expired', 'transferred', 'upgraded');
CREATE TYPE payment_provider AS ENUM ('stripe', 'antom');
CREATE TYPE payment_status AS ENUM ('requires_payment', 'processing', 'succeeded', 'failed', 'refunded');
CREATE TYPE payment_method_family AS ENUM ('card', 'wallet', 'local_wallet');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text UNIQUE,
  locale text NOT NULL DEFAULT 'en',
  roles user_role[] NOT NULL DEFAULT ARRAY['student']::user_role[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email', 'phone')),
  value text NOT NULL UNIQUE,
  password_hash text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_role user_role NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  age integer,
  years_of_experience integer NOT NULL DEFAULT 0,
  tags jsonb NOT NULL DEFAULT '[]',
  bio jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES course_categories(id),
  title jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}',
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_amount integer NOT NULL CHECK (price_amount >= 0),
  currency char(3) NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  member_card_deduct_count integer NOT NULL DEFAULT 1 CHECK (member_card_deduct_count > 0),
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id),
  coach_id uuid NOT NULL REFERENCES coach_profiles(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  booked_count integer NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (booked_count <= capacity)
);

CREATE INDEX idx_course_sessions_starts_at ON course_sessions(starts_at);
CREATE INDEX idx_course_sessions_coach ON course_sessions(coach_id, starts_at);

CREATE TABLE coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,
  total_credits integer NOT NULL CHECK (total_credits > 0),
  price_amount integer NOT NULL CHECK (price_amount >= 0),
  currency char(3) NOT NULL,
  validity_days integer NOT NULL CHECK (validity_days > 0),
  benefits text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES membership_plans(id),
  status member_card_status NOT NULL DEFAULT 'active',
  total_credits integer NOT NULL CHECK (total_credits >= 0),
  remaining_credits integer NOT NULL CHECK (remaining_credits >= 0),
  expires_at timestamptz NOT NULL,
  frozen_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_credits <= total_credits)
);

CREATE INDEX idx_member_cards_user_status ON member_cards(user_id, status);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  course_session_id uuid NOT NULL REFERENCES course_sessions(id),
  coach_id uuid NOT NULL REFERENCES coach_profiles(id),
  order_id uuid,
  member_card_id uuid REFERENCES member_cards(id),
  status booking_status NOT NULL DEFAULT 'pending_payment',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  checked_in_at timestamptz
);

CREATE INDEX idx_bookings_user ON bookings(user_id, starts_at DESC);
CREATE INDEX idx_bookings_session ON bookings(course_session_id, status);
CREATE INDEX idx_bookings_coach ON bookings(coach_id, starts_at DESC);

CREATE TABLE check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  user_id uuid NOT NULL REFERENCES users(id),
  method text NOT NULL CHECK (method IN ('qr', 'manual')),
  checked_in_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES member_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL,
  credits integer NOT NULL,
  reason text NOT NULL,
  booking_id uuid REFERENCES bookings(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}',
  category text NOT NULL,
  price_amount integer NOT NULL CHECK (price_amount >= 0),
  currency char(3) NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'refunded')),
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  currency char(3) NOT NULL,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD CONSTRAINT fk_bookings_order FOREIGN KEY (order_id) REFERENCES orders(id);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('course_session', 'product', 'membership_plan')),
  ref_id uuid NOT NULL,
  title jsonb NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_amount integer NOT NULL CHECK (unit_amount >= 0),
  currency char(3) NOT NULL
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  user_id uuid NOT NULL REFERENCES users(id),
  payment_provider payment_provider NOT NULL DEFAULT 'stripe',
  payment_method_family payment_method_family NOT NULL,
  payment_method_code text NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL,
  country char(2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'requires_payment',
  refund_status text NOT NULL DEFAULT 'none',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_charge_id text,
  webhook_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD CONSTRAINT fk_orders_payment FOREIGN KEY (payment_id) REFERENCES payments(id);
CREATE UNIQUE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_stripe_cs ON payments(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_webhook_event ON payments(webhook_event_id) WHERE webhook_event_id IS NOT NULL;

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  amount integer NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL,
  reason text,
  provider_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  coach_id uuid REFERENCES coach_profiles(id),
  course_id uuid REFERENCES courses(id),
  booking_id uuid REFERENCES bookings(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  measured_at timestamptz NOT NULL,
  flexibility_score integer CHECK (flexibility_score BETWEEN 0 AND 100),
  balance_score integer CHECK (balance_score BETWEEN 0 AND 100),
  notes text
);

CREATE TABLE content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('banner', 'feature', 'recommendation', 'knowledge')),
  title jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}',
  image_url text,
  target text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en', 'zh-Hans', 'ko')),
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field_name, locale)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_role user_role,
  action text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  scope text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, scope)
);
