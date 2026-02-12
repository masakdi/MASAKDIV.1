# 🎯 ระบบสมาชิกและแต้มสะสม - สรุปการพัฒนา

## ✅ สิ่งที่ทำเสร็จแล้ว

### 1. **Database Schema** (`sql/membership_system.sql`)

#### ตารางที่สร้างใหม่:
- **`membership_tiers`** - ระดับสมาชิก (Verified User, Member, Silver, Gold, Platinum)
- **`platform_fees`** - ค่าบริการแพลตฟอร์ม (20 บาท)
- **`user_points`** - แต้มสะสมของผู้ใช้
- **`point_transactions`** - ประวัติการเพิ่ม/ใช้แต้ม

#### การแก้ไขตารางเดิม:
- **`users`** - เพิ่ม:
  - `membership_tier` (verified_user, member, silver, gold, platinum)
  - `membership_started_at`
  - `completed_orders_count` (นับออเดอร์ที่สำเร็จ)
  - `contact_name`, `contact_phone`, `contact_address`

- **`orders`** - เพิ่ม:
  - `platform_fee` (ค่าบริการแพลตฟอร์ม)
  - `discount_amount` (จำนวนส่วนลด)
  - `discount_reason` (เหตุผลส่วนลด)
  - `subtotal_before_discount`
  - `points_earned` (แต้มที่ได้รับ)
  - `basket_photo_url`

#### Functions & Triggers:
- **`update_user_points_on_order_complete()`** - อัพเดทแต้มอัตโนมัติเมื่อออเดอร์สำเร็จ
  - 1 ออเดอร์ = 1 แต้ม
  - อัพเดท `completed_orders_count` อัตโนมัติ

---

### 2. **API Endpoints**

#### `/api/membership` (GET)
- ดึงข้อมูลสมาชิก: tier, completed orders, points
- Parameter: `user_id`

#### `/api/calculate-price` (POST)
- คำนวณราคาตามระดับสมาชิก
- Parameters: `user_id`, `baskets`, `delivery_mode`
- Return: ราคาทั้งหมดพร้อมส่วนลด

---

### 3. **Frontend Updates** (`src/app/page.tsx`)

#### State ใหม่:
```typescript
const [membershipTier, setMembershipTier] = useState<string>("verified_user");
const [completedOrdersCount, setCompletedOrdersCount] = useState<number>(0);
const [availablePoints, setAvailablePoints] = useState<number>(0);
const [platformFee, setPlatformFee] = useState<number>(20);
const [discountAmount, setDiscountAmount] = useState<number>(0);
const [discountReason, setDiscountReason] = useState<string>("");
```

#### การคำนวณราคา:
- **ลูกค้าทั่วไป (verified_user)**: ค่าซัก + ค่าส่ง + ค่าบริการแพลตฟอร์ม (20฿)
- **สมาชิก - ออเดอร์แรก**: ค่าซัก + ค่าบริการแพลตฟอร์ม (ฟรีค่าส่ง 🎁)
- **สมาชิก - ออเดอร์ที่ 2+**: (ค่าซัก + ค่าส่ง) × 0.85 + ค่าบริการแพลตฟอร์ม (ลด 15%)

#### UI Updates:
- แสดงระดับสมาชิกและแต้มสะสมใน Step 3
- แสดงส่วนลดแยกบรรทัด (สีเขียว)
- แสดงค่าบริการแพลตฟอร์มแยกชัดเจน

---

## 📋 ข้อมูลเริ่มต้นที่ Insert แล้ว

### Membership Tiers:
| Tier | Display Name | Min Orders | Subscription Price | Discount |
|------|--------------|------------|-------------------|----------|
| verified_user | Verified User | 0 | 0฿ | 0% |
| member | Member | 0 | 99฿ | 15% |
| silver | Silver | 10 | 199฿ | 15% |
| gold | Gold | 30 | 299฿ | 15% |
| platinum | Platinum | 50 | 399฿ | 15% |

### Platform Fees:
| Fee Type | Amount |
|----------|--------|
| standard | 20฿ |
| member | 20฿ |

---

## 🔄 ขั้นตอนการทำงาน

### 1. เมื่อผู้ใช้เข้าสู่ระบบ:
1. ดึงข้อมูลสมาชิกจาก `/api/membership`
2. แสดงระดับสมาชิกและแต้มสะสม
3. โหลดค่าบริการแพลตฟอร์มจาก database

### 2. เมื่อคำนวณราคา:
1. เช็คระดับสมาชิก (`membership_tier`)
2. เช็คจำนวนออเดอร์ที่สำเร็จ (`completed_orders_count`)
3. คำนวณส่วนลดตามเงื่อนไข:
   - **verified_user**: ไม่มีส่วนลด
   - **สมาชิก + ออเดอร์แรก**: ฟรีค่าส่ง
   - **สมาชิก + ออเดอร์ที่ 2+**: ลด 15%

### 3. เมื่อส่งออเดอร์:
1. บันทึกข้อมูลส่วนลดลง database
2. บันทึก `platform_fee`, `discount_amount`, `discount_reason`
3. คำนวณ `total_amount` ที่ถูกต้อง

### 4. เมื่อออเดอร์สำเร็จ (status = 'completed'):
1. Trigger อัตโนมัติเพิ่มแต้ม 1 แต้ม
2. อัพเดท `completed_orders_count + 1`
3. บันทึกประวัติใน `point_transactions`

---

## 🚀 สิ่งที่ต้องทำต่อ

### 1. **Run SQL Migration**
```bash
# เชื่อมต่อ Supabase และรัน:
psql -h <your-supabase-host> -U postgres -d postgres -f sql/membership_system.sql
```

หรือใช้ Supabase Dashboard:
1. ไปที่ SQL Editor
2. Copy-paste จาก `sql/membership_system.sql`
3. กด Run

### 2. **ทดสอบระบบ**
- [ ] ทดสอบการสมัครสมาชิก
- [ ] ทดสอบการคำนวณราคาสำหรับลูกค้าทั่วไป
- [ ] ทดสอบฟรีค่าส่งครั้งแรก (สมาชิก)
- [ ] ทดสอบส่วนลด 15% (ออเดอร์ที่ 2+)
- [ ] ทดสอบการได้แต้มเมื่อออเดอร์สำเร็จ

### 3. **สร้างหน้าจัดการสมาชิก** (Optional)
- หน้าสมัครสมาชิก (อัพโหลดสลิป)
- หน้าดูแต้มสะสม
- หน้าแลกของรางวัล
- หน้าอัพเกรดระดับสมาชิก

### 4. **Admin Dashboard**
- หน้าอนุมัติการสมัครสมาชิก
- หน้าจัดการระดับสมาชิก
- หน้าตั้งค่าค่าบริการแพลตฟอร์ม
- หน้าดูรายงานแต้มสะสม

---

## 📊 ตัวอย่างการใช้งาน

### ตัวอย่างที่ 1: ลูกค้าทั่วไป
```
ค่าซัก: 100฿
ค่าส่ง: 50฿
ค่าบริการแพลตฟอร์ม: 20฿
─────────────────
ยอดรวม: 170฿
```

### ตัวอย่างที่ 2: สมาชิก - ออเดอร์แรก
```
ค่าซัก: 100฿
ค่าส่ง: 50฿ → ฟรี 🎁
ค่าบริการแพลตฟอร์ม: 20฿
─────────────────
ยอดรวม: 120฿ (ประหยัด 50฿)
```

### ตัวอย่างที่ 3: สมาชิก - ออเดอร์ที่ 2+
```
ค่าซัก: 100฿
ค่าส่ง: 50฿
รวม: 150฿
ส่วนลดสมาชิก 15%: -22.5฿
ค่าบริการแพลตฟอร์ม: 20฿
─────────────────
ยอดรวม: 147.5฿ (ประหยัด 22.5฿)
```

---

## 🔧 การตั้งค่าเพิ่มเติม

### แก้ไขค่าบริการแพลตฟอร์ม:
```sql
UPDATE platform_fees 
SET amount = 25 
WHERE fee_type = 'standard';
```

### แก้ไขราคาค่าสมัครสมาชิก:
```sql
UPDATE membership_tiers 
SET subscription_price = 149 
WHERE tier_name = 'member';
```

### แก้ไขเปอร์เซ็นต์ส่วนลด:
```sql
UPDATE membership_tiers 
SET discount_percent = 20 
WHERE tier_name = 'gold';
```

---

## 📝 หมายเหตุ

1. **ระบบแต้ม**: ตอนนี้ 1 ออเดอร์ = 1 แต้ม (สามารถปรับได้ใน trigger)
2. **การอัพเกรดระดับ**: ยังไม่มีระบบอัพเกรดอัตโนมัติ (ต้องทำ manual หรือสร้าง trigger เพิ่ม)
3. **การแลกของรางวัล**: ยังไม่ได้ implement (ต้องสร้างตาราง `rewards` และ `reward_redemptions`)
4. **หมดอายุแต้ม**: ยังไม่มีระบบหมดอายุ (ถ้าต้องการต้องเพิ่ม `expires_at` ใน `point_transactions`)

---

## 🎉 สรุป

ระบบสมาชิกและแต้มสะสมพร้อมใช้งานแล้ว! 
- ✅ Database schema พร้อม
- ✅ API endpoints พร้อม
- ✅ Frontend integration พร้อม
- ✅ Auto point earning พร้อม

เหลือแค่ **Run SQL Migration** แล้วทดสอบระบบได้เลยครับ! 🚀
