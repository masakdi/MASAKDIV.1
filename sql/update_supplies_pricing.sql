-- 1. เพิ่มคอลัมน์ size ถ้ายังไม่มี
ALTER TABLE laundry_supplies ADD COLUMN IF NOT EXISTS size TEXT;

-- 2. ลบ Unique Constraint เดิมที่ล็อคแค่คอลัมน์ key อย่างเดียว
-- (ชื่อตาม Error: laundry_supplies_key_key)
ALTER TABLE laundry_supplies DROP CONSTRAINT IF EXISTS laundry_supplies_key_key;

-- 3. ลบข้อมูลเก่าที่ไม่มี size ออก เพื่อล้างข้อมูลให้สะอาด
DELETE FROM laundry_supplies WHERE size IS NULL;

-- 4. เพิ่ม Unique Constraint ใหม่ที่ล็อคคู่ (key, size)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_key_size') THEN
        ALTER TABLE laundry_supplies ADD CONSTRAINT unique_key_size UNIQUE (key, size);
    END IF;
END $$;

-- 5. ใส่ข้อมูลราคาใหม่แยกตามไซส์
INSERT INTO laundry_supplies (key, size, price, active)
VALUES 
  ('detergent', 'S', 10, true),
  ('detergent', 'M', 15, true),
  ('detergent', 'L', 15, true),
  ('softener', 'S', 10, true),
  ('softener', 'M', 15, true),
  ('softener', 'L', 15, true)
ON CONFLICT (key, size) DO UPDATE SET price = EXCLUDED.price;
