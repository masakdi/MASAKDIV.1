-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_groups (
  id bigint NOT NULL DEFAULT nextval('admin_groups_id_seq'::regclass),
  group_id text NOT NULL UNIQUE,
  name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_groups_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booking_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  max_orders_per_day integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_configs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['fixed'::text, 'percent'::text])),
  discount_value numeric NOT NULL CHECK (discount_value >= 0::numeric),
  min_order_amount numeric DEFAULT 0 CHECK (min_order_amount >= 0::numeric),
  max_discount_amount numeric CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0::numeric),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_per_user_limit integer DEFAULT 1 CHECK (usage_per_user_limit > 0),
  used_count integer DEFAULT 0,
  start_date timestamp with time zone DEFAULT now(),
  end_date timestamp with time zone,
  applicable_types jsonb DEFAULT '["all"]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_public boolean DEFAULT false,
  allowed_roles jsonb DEFAULT '["all"]'::jsonb,
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.delivery_fee_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mode USER-DEFINED NOT NULL UNIQUE,
  fee_1 numeric NOT NULL CHECK (fee_1 >= 0::numeric),
  fee_2 numeric NOT NULL CHECK (fee_2 >= 0::numeric),
  extra_per_basket numeric NOT NULL CHECK (extra_per_basket >= 0::numeric),
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT delivery_fee_schedules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.laundry_base_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  size USER-DEFINED NOT NULL,
  svc USER-DEFINED NOT NULL,
  price_ex_delivery numeric NOT NULL CHECK (price_ex_delivery >= 0::numeric),
  breakdown jsonb,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT laundry_base_prices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.laundry_supplies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  active boolean NOT NULL DEFAULT true,
  size text,
  CONSTRAINT laundry_supplies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.membership_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  min_orders integer NOT NULL DEFAULT 0,
  subscription_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT membership_tiers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slip_url text,
  amount numeric NOT NULL DEFAULT 99,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT memberships_pkey PRIMARY KEY (id),
  CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.order_counters (
  day date NOT NULL,
  prefix text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  CONSTRAINT order_counters_pkey PRIMARY KEY (day, prefix)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'washing'::text, 'ready'::text, 'delivering'::text, 'completed'::text, 'cancelled'::text])),
  delivery_fee numeric CHECK (delivery_fee >= 0::numeric),
  delivery jsonb,
  addons jsonb,
  note text,
  slip_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  base_price numeric CHECK (base_price >= 0::numeric),
  supplies_total numeric DEFAULT 0 CHECK (supplies_total >= 0::numeric),
  order_number text UNIQUE,
  total_amount numeric DEFAULT ((COALESCE(base_price, (0)::numeric) + COALESCE(supplies_total, (0)::numeric)) + COALESCE(delivery_fee, (0)::numeric)) CHECK (total_amount >= 0::numeric),
  contact_name text,
  contact_phone text,
  platform_fee numeric DEFAULT 20 CHECK (platform_fee >= 0::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  discount_reason text,
  subtotal_before_discount numeric DEFAULT 0,
  points_earned integer DEFAULT 0,
  basket_photo_url text,
  order_type text DEFAULT 'normal'::text CHECK (order_type = ANY (ARRAY['normal'::text, 'booking'::text])),
  scheduled_date date,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_customer_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id)
);
CREATE TABLE public.phone_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  CONSTRAINT phone_verification_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT phone_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.platform_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fee_type text NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 20 CHECK (amount >= 0::numeric),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_fees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.point_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  points integer NOT NULL,
  transaction_type text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT point_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT point_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category USER-DEFINED NOT NULL,
  detail text NOT NULL CHECK (length(TRIM(BOTH FROM detail)) >= 10),
  contact_phone text CHECK (contact_phone ~ '^[0-9]{9,10}$'::text),
  image_urls ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'collected'::text CHECK (status = ANY (ARRAY['collected'::text, 'used'::text])),
  used_at timestamp with time zone,
  order_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_coupons_pkey PRIMARY KEY (id),
  CONSTRAINT user_coupons_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT user_coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_coupons_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.user_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  total_points integer NOT NULL DEFAULT 0,
  used_points integer NOT NULL DEFAULT 0,
  available_points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_points_pkey PRIMARY KEY (id),
  CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  line_user_id text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  phone text,
  phone_verified boolean NOT NULL DEFAULT false,
  phone_verified_at timestamp with time zone,
  role text NOT NULL DEFAULT 'standard'::text CHECK (role = ANY (ARRAY['standard'::text, 'member'::text, 'admin'::text])),
  address text,
  membership_expires_at timestamp with time zone,
  is_member boolean NOT NULL DEFAULT false,
  member_status text NOT NULL DEFAULT 'pending'::text,
  nickname text,
  membership_tier text DEFAULT 'verified_user'::text,
  membership_started_at timestamp with time zone,
  completed_orders_count integer NOT NULL DEFAULT 0,
  contact_name text,
  contact_phone text,
  contact_address text,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])),
  birth_date date,
  google_map_link text,
  has_used_free_delivery boolean DEFAULT false,
  free_delivery_count integer DEFAULT 0,
  last_activity_at timestamp with time zone DEFAULT now(),
  last_rank_reset_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);