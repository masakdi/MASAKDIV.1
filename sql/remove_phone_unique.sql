-- ========================================
-- 🔧 ลบ UNIQUE constraint จากคอลัมน์ phone
-- ========================================

-- ลบ constraint ที่ชื่อ users_phone_key
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_phone_key;

-- ถ้าต้องการเพิ่ม index กลับมา (ไม่ unique) เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);

-- หมายเหตุ: หลังจากลบ unique constraint แล้ว
-- - เบอร์โทรสามารถซ้ำกันได้
-- - ยังค้นหาได้เร็วเพราะมี index
-- - ไม่มี error duplicate key อีกต่อไป
