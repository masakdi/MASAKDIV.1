-- =====================================================================
-- ซักเครื่องนอน: ตารางราคา (แก้ได้จากหน้าแอดมิน → บริการ)
-- ออเดอร์เครื่องนอนเก็บรายละเอียดใน orders.addons ->> 'service' = 'bedding'
-- รันใน Supabase SQL Editor ของ project v.1
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.bedding_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ราคาเริ่มต้น (เท่ากับ masakdi_app) — แก้ภายหลังได้จากหน้าแอดมิน
INSERT INTO public.bedding_prices (key, label, price, sort_order) VALUES
  ('set_3.5_thin',        'ชุดเครื่องนอน 3.5 ฟุต แบบบาง',        120, 1),
  ('set_3.5_thick',       'ชุดเครื่องนอน 3.5 ฟุต แบบหนา',        150, 2),
  ('set_5-6_thin',        'ชุดเครื่องนอน 5-6 ฟุต แบบบาง',        150, 3),
  ('set_5-6_thick',       'ชุดเครื่องนอน 5-6 ฟุต แบบหนา',        180, 4),
  ('extra_thin_blanket',  'เพิ่มผ้าห่มแบบบาง (ต่อผืน)',           30, 5),
  ('extra_thick_blanket', 'เพิ่มผ้าห่ม/ผ้านวมแบบหนา (ต่อผืน)',    50, 6),
  ('detergent',           'ผงซักฟอก (ต่อออเดอร์)',                15, 7),
  ('softener',            'ปรับผ้านุ่ม (ต่อออเดอร์)',              15, 8)
ON CONFLICT (key) DO NOTHING;

-- ทุกคนอ่านได้ (หน้าสั่งซักใช้คำนวณราคา) แต่แก้ได้ผ่าน API แอดมินเท่านั้น
ALTER TABLE public.bedding_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bedding_prices readable by everyone" ON public.bedding_prices;
CREATE POLICY "bedding_prices readable by everyone" ON public.bedding_prices
  FOR SELECT USING (true);
