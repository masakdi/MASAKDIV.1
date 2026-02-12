-- ========================================
-- 🔧 Add Free Delivery Count tracking
-- ========================================

-- เพิ่มคอลัมน์เก็บจำนวนสิทธิ์ส่งฟรีที่เหลือ
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS free_delivery_count integer DEFAULT 0;

-- อัปเดตข้อมูลเดิม: ถ้าเคยใช้ฟรีไปแล้ว (has_used_free_delivery = true) ให้เป็น 0 
-- ถ้ายังไม่เคยใช้ ให้ตั้งตามระดับสมาชิก (แต่เนื่องจากระบบเดิมมีแค่ true/false เราจะตั้งเป็น 0 ไว้ก่อนเพื่อให้ Admin ปรับเอง)
UPDATE public.users SET free_delivery_count = 0; 
