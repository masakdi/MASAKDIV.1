-- ========================================
-- 🔧 เพิ่มฟิลด์ใหม่สำหรับข้อมูลสมาชิก
-- ========================================

-- เพิ่มฟิลด์ในตาราง users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS google_map_link TEXT;

-- เพิ่ม index เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_users_gender ON public.users(gender);
CREATE INDEX IF NOT EXISTS idx_users_birth_date ON public.users(birth_date);

-- Comment
COMMENT ON COLUMN public.users.gender IS 'เพศ: male, female, other';
COMMENT ON COLUMN public.users.birth_date IS 'วันเกิด';
COMMENT ON COLUMN public.users.google_map_link IS 'ลิงก์ Google Map สำหรับที่อยู่';
