-- ========================================
-- 🎯 Membership & Points System
-- ========================================

-- 1️⃣ สร้างตาราง membership_tiers (ระดับสมาชิก)
CREATE TABLE IF NOT EXISTS public.membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE, -- 'member', 'silver', 'gold', 'platinum'
  display_name TEXT NOT NULL, -- 'Member', 'Silver', 'Gold', 'Platinum'
  min_orders INTEGER NOT NULL DEFAULT 0, -- จำนวนออเดอร์ขั้นต่ำที่ต้องมี
  subscription_price NUMERIC NOT NULL DEFAULT 0, -- ราคาค่าสมัคร (บาท)
  discount_percent NUMERIC NOT NULL DEFAULT 0, -- ส่วนลด % (สำหรับอนาคต)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2️⃣ สร้างตาราง platform_fees (ค่าบริการแพลตฟอร์ม)
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type TEXT NOT NULL UNIQUE, -- 'standard', 'member', etc.
  amount NUMERIC NOT NULL DEFAULT 20 CHECK (amount >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3️⃣ สร้างตาราง user_points (แต้มสะสมของผู้ใช้)
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0, -- แต้มสะสมทั้งหมด
  used_points INTEGER NOT NULL DEFAULT 0, -- แต้มที่ใช้ไปแล้ว
  available_points INTEGER NOT NULL DEFAULT 0, -- แต้มคงเหลือ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_points_user_id_unique UNIQUE (user_id)
);

-- 4️⃣ สร้างตาราง point_transactions (ประวัติการเพิ่ม/ใช้แต้ม)
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points INTEGER NOT NULL, -- จำนวนแต้ม (+ = ได้รับ, - = ใช้ไป)
  transaction_type TEXT NOT NULL, -- 'earned', 'redeemed', 'expired'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5️⃣ แก้ไขตาราง users เพื่อเพิ่มข้อมูลสมาชิก
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'verified_user', -- 'verified_user', 'member', 'silver', 'gold', 'platinum'
  ADD COLUMN IF NOT EXISTS membership_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_orders_count INTEGER NOT NULL DEFAULT 0, -- นับจำนวนออเดอร์ที่สำเร็จ
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_address TEXT;

-- 6️⃣ แก้ไขตาราง orders เพื่อเพิ่มข้อมูลการคำนวณราคา
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 20 CHECK (platform_fee >= 0),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason TEXT, -- 'first_order_free_delivery', 'member_15_percent', etc.
  ADD COLUMN IF NOT EXISTS subtotal_before_discount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS basket_photo_url TEXT;

-- 7️⃣ แก้ไข total_amount calculation
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_total_amount_check;

-- สร้าง constraint ใหม่
ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_amount_check 
  CHECK (total_amount >= 0);

-- 8️⃣ Insert ข้อมูลเริ่มต้น - Membership Tiers
INSERT INTO public.membership_tiers (tier_name, display_name, min_orders, subscription_price, discount_percent) VALUES
  ('verified_user', 'Verified User', 0, 0, 0),
  ('member', 'Member', 0, 99, 15),
  ('silver', 'Silver', 10, 199, 15),
  ('gold', 'Gold', 30, 299, 15),
  ('platinum', 'Platinum', 50, 399, 15)
ON CONFLICT (tier_name) DO NOTHING;

-- 9️⃣ Insert ข้อมูลเริ่มต้น - Platform Fees
INSERT INTO public.platform_fees (fee_type, amount) VALUES
  ('standard', 20),
  ('member', 20)
ON CONFLICT (fee_type) DO NOTHING;

-- 🔟 สร้าง Function: อัพเดทแต้มเมื่อออเดอร์สำเร็จ
CREATE OR REPLACE FUNCTION update_user_points_on_order_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- เช็คว่าสถานะเปลี่ยนเป็น 'completed' หรือไม่
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- เพิ่มแต้มให้ผู้ใช้ (1 order = 1 point)
    INSERT INTO public.user_points (user_id, total_points, available_points)
    VALUES (NEW.customer_id, 1, 1)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_points = user_points.total_points + 1,
      available_points = user_points.available_points + 1,
      updated_at = NOW();
    
    -- บันทึกประวัติการได้แต้ม
    INSERT INTO public.point_transactions (user_id, order_id, points, transaction_type, description)
    VALUES (NEW.customer_id, NEW.id, 1, 'earned', 'Earned from order completion');
    
    -- อัพเดทจำนวนออเดอร์ที่สำเร็จของผู้ใช้
    UPDATE public.users
    SET completed_orders_count = completed_orders_count + 1
    WHERE id = NEW.customer_id;
    
    -- อัพเดท points_earned ใน order
    UPDATE public.orders
    SET points_earned = 1
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง Trigger
DROP TRIGGER IF EXISTS trigger_update_points_on_order_complete ON public.orders;
CREATE TRIGGER trigger_update_points_on_order_complete
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_user_points_on_order_complete();

-- 1️⃣1️⃣ สร้าง Index เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_users_membership_tier ON public.users(membership_tier);
CREATE INDEX IF NOT EXISTS idx_users_completed_orders ON public.users(completed_orders_count);
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON public.orders(customer_id, status);

-- 1️⃣2️⃣ สร้าง View: ข้อมูลสมาชิกพร้อมแต้ม
CREATE OR REPLACE VIEW user_membership_summary AS
SELECT 
  u.id,
  u.line_user_id,
  u.full_name,
  u.membership_tier,
  u.completed_orders_count,
  u.membership_started_at,
  COALESCE(up.available_points, 0) as available_points,
  COALESCE(up.total_points, 0) as total_points,
  mt.display_name as tier_display_name,
  mt.discount_percent
FROM public.users u
LEFT JOIN public.user_points up ON u.id = up.user_id
LEFT JOIN public.membership_tiers mt ON u.membership_tier = mt.tier_name;

COMMENT ON TABLE public.membership_tiers IS 'ระดับสมาชิกและเงื่อนไขต่างๆ';
COMMENT ON TABLE public.platform_fees IS 'ค่าบริการแพลตฟอร์ม';
COMMENT ON TABLE public.user_points IS 'แต้มสะสมของผู้ใช้';
COMMENT ON TABLE public.point_transactions IS 'ประวัติการเพิ่ม/ใช้แต้ม';
