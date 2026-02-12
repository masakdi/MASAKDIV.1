-- ========================================
-- 🔧 Update Membership Tier Logic
-- ========================================

-- ปรับปรุง Function: อัพเดทแต้มและอัพเกรดระดับสมาชิกอัตโนมัติเมื่อออเดอร์สำเร็จ
CREATE OR REPLACE FUNCTION update_user_points_on_order_complete()
RETURNS TRIGGER AS $$
DECLARE
  new_orders_count INTEGER;
  current_tier TEXT;
BEGIN
  -- เช็คว่าสถานะเปลี่ยนเป็น 'completed' หรือไม่
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- 1. เพิ่มแต้มให้ผู้ใช้ (1 order = 1 point)
    INSERT INTO public.user_points (user_id, total_points, available_points)
    VALUES (NEW.customer_id, 1, 1)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_points = user_points.total_points + 1,
      available_points = user_points.available_points + 1,
      updated_at = NOW();
    
    -- 2. บันทึกประวัติการได้แต้ม
    INSERT INTO public.point_transactions (user_id, order_id, points, transaction_type, description)
    VALUES (NEW.customer_id, NEW.id, 1, 'earned', 'Earned from order completion');
    
    -- 3. อัพเดทจำนวนออเดอร์ที่สำเร็จของผู้ใช้
    UPDATE public.users
    SET completed_orders_count = completed_orders_count + 1
    WHERE id = NEW.customer_id;
    
    -- 4. (Removed) อัพเกรดระดับสมาชิกอัตโนมัติถูกยกเลิกตามความต้องการของผู้ใช้
    
    
    -- 5. อัพเดท points_earned ใน order
    UPDATE public.orders
    SET points_earned = 1
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
