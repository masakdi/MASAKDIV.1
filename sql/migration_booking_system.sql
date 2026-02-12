-- Migration to support Order Booking System

-- 1. Update orders table to support booking
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'normal' CHECK (order_type IN ('normal', 'booking')),
ADD COLUMN IF NOT EXISTS scheduled_date date;

-- 2. Create booking_configs table for Admin to manage available days
CREATE TABLE IF NOT EXISTS public.booking_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL, -- 0 (Sunday) to 6 (Saturday)
  is_active boolean DEFAULT true,
  max_orders_per_day integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_configs_pkey PRIMARY KEY (id),
  CONSTRAINT booking_configs_day_unique UNIQUE (day_of_week)
);

-- 3. Insert default allowed days (Monday=1, Wednesday=3)
INSERT INTO public.booking_configs (day_of_week, is_active) 
VALUES (1, true), (3, true)
ON CONFLICT (day_of_week) DO UPDATE SET is_active = EXCLUDED.is_active;
