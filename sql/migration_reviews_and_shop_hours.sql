-- =====================================================================
-- 1) CRM: รีวิวออเดอร์ (ดาว 1-5 + คอมเมนต์) — 1 ออเดอร์รีวิวได้ 1 ครั้ง
-- 2) เวลาเปิด-ปิดรับออเดอร์ (แก้ได้จากหน้าแอดมิน)
-- รันใน Supabase SQL Editor ของ project v.1
-- =====================================================================

-- ---------- 1) order_reviews ----------
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_reviews_created_at_idx ON public.order_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS order_reviews_customer_idx ON public.order_reviews (customer_id);

-- อ่าน/เขียนผ่าน API ฝั่ง server (service role) เท่านั้น จึงเปิด RLS โดยไม่มี policy
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

-- ---------- 2) shop_hours (มีแถวเดียว id = 1) ----------
CREATE TABLE IF NOT EXISTS public.shop_hours (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  -- ปิดรับออเดอร์ก่อนเวลาปิดจริงกี่นาที (ปิด 18:00 → รับถึง 17:45)
  cutoff_minutes integer NOT NULL DEFAULT 15 CHECK (cutoff_minutes BETWEEN 0 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.shop_hours (id, open_time, close_time, cutoff_minutes)
VALUES (1, '09:00', '18:00', 15)
ON CONFLICT (id) DO NOTHING;

-- ทุกคนอ่านได้ (หน้าสั่งซักใช้แสดงเวลา) แต่แก้ได้ผ่าน API แอดมินเท่านั้น
ALTER TABLE public.shop_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_hours readable by everyone" ON public.shop_hours;
CREATE POLICY "shop_hours readable by everyone" ON public.shop_hours
  FOR SELECT USING (true);
