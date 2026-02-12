-- Create coupons table
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value numeric NOT NULL CHECK (discount_value >= 0),
  min_order_amount numeric DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount numeric DEFAULT NULL CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  usage_limit integer DEFAULT NULL CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_per_user_limit integer DEFAULT 1 CHECK (usage_per_user_limit > 0),
  used_count integer DEFAULT 0,
  start_date timestamp with time zone DEFAULT now(),
  end_date timestamp with time zone,
  applicable_types jsonb DEFAULT '["all"]'::jsonb, -- ['all', 'laundry', 'dry', 'delivery']
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id),
  CONSTRAINT coupons_code_key UNIQUE (code)
);

-- Create user_coupons table for tracking collections and usage
CREATE TABLE public.user_coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'used')),
  used_at timestamp with time zone,
  order_id uuid, -- Reference to the order where it was used
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_coupons_pkey PRIMARY KEY (id),
  CONSTRAINT user_coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_coupons_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT user_coupons_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

-- Index for faster lookups
CREATE INDEX idx_user_coupons_user_id ON public.user_coupons(user_id);
CREATE INDEX idx_user_coupons_coupon_id ON public.user_coupons(coupon_id);
