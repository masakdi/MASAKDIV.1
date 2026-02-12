import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Basket = {
  size: string;
  service: string;
  softener: boolean;
  detergent: boolean;
  qty: number;
};

export async function POST(req: Request) {
  try {
    const {
      user_id,
      baskets,
      delivery_mode,
    }: {
      user_id: string;
      baskets: Basket[];
      delivery_mode: "pickup_only" | "pickup_and_return";
    } = await req.json();

    if (!user_id || !baskets || baskets.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 0️⃣ Silent Check Member Rank & Points (System-wide enforcement)
    const { checkAndResetMembership } = await import("@/app/lib/membershipManager");
    await checkAndResetMembership(user_id);

    // 1️⃣ ดึงข้อมูลผู้ใช้ (After potential reset)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("membership_tier, completed_orders_count")
      .eq("id", user_id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membershipTier = userData.membership_tier || "verified_user";
    const completedOrders = userData.completed_orders_count || 0;

    // 2️⃣ ดึงราคาฐาน
    const { data: basePrices } = await supabase
      .from("laundry_base_prices")
      .select("size, svc, price_ex_delivery, breakdown")
      .eq("active", true);

    // 3️⃣ ดึงค่าส่ง
    const { data: deliveryFees } = await supabase
      .from("delivery_fee_schedules")
      .select("mode, fee_1, fee_2, extra_per_basket")
      .eq("active", true);

    // 4️⃣ ดึงค่าบริการแพลตฟอร์ม
    const { data: platformFeeData } = await supabase
      .from("platform_fees")
      .select("amount")
      .eq("fee_type", "standard")
      .eq("active", true)
      .single();

    const platformFee = platformFeeData?.amount || 20;

    // 4.5️⃣ ดึงค่าน้ำยา
    const { data: suppliesData } = await supabase
      .from("laundry_supplies")
      .select("key, size, price")
      .eq("active", true);

    // 5️⃣ คำนวณราคาฐาน (ค่าซัก)
    let basePrice = 0;
    let suppliesTotal = 0;
    let totalPlatformFee = 0;

    baskets.forEach((basket) => {
      let fullServicePrice = 0;
      
      if (basket.service === "wash_and_dry") {
        const washRow = basePrices?.find(p => p.size === basket.size && p.svc === "wash_only");
        const dryRow = basePrices?.find(p => p.size === basket.size && p.svc === "dry_only");
        fullServicePrice = (washRow?.price_ex_delivery || 0) + (dryRow?.price_ex_delivery || 0);
      } else {
        const priceRow = basePrices?.find(
          (p: any) => p.size === basket.size && p.svc === basket.service
        );
        if (priceRow) {
          fullServicePrice = priceRow.price_ex_delivery;
        }
      }

      const qty = basket.qty || 1;
      // ลบค่าธรรมเนียมออกก่อนเก็บเข้า basePrice เพื่อให้ตรงกับโครงสร้างใน Frontend
      basePrice += Math.max(0, fullServicePrice - platformFee) * qty;
      totalPlatformFee += platformFee * qty;

      // คำนวณค่าน้ำยา
      if (basket.softener || basket.detergent) {
        const softPrice = basket.softener ? (suppliesData?.find(s => s.key === 'softener' && s.size === basket.size)?.price || (basket.size === 'S' ? 10 : 15)) : 0;
        const detPrice = basket.detergent ? (suppliesData?.find(s => s.key === 'detergent' && s.size === basket.size)?.price || (basket.size === 'S' ? 10 : 15)) : 0;
        
        suppliesTotal += (Number(softPrice) + Number(detPrice)) * qty;
      }
    });

    // 6️⃣ คำนวณค่าส่ง
    const deliverySchedule = deliveryFees?.find(
      (d: any) => d.mode === delivery_mode
    );
    let deliveryFee = 0;

    if (deliverySchedule) {
      const basketCount = baskets.length;
      if (basketCount === 1) {
        deliveryFee = deliverySchedule.fee_1;
      } else if (basketCount === 2) {
        deliveryFee = deliverySchedule.fee_2;
      } else {
        deliveryFee =
          deliverySchedule.fee_2 +
          (basketCount - 2) * deliverySchedule.extra_per_basket;
      }
    }

    // 7️⃣ คำนวณส่วนลดและยอดรวม
    let discountAmount = 0;
    let discountReason = "";
    // ยอดรวมก่อนหักส่วนลด (ซัก + น้ำยา + ส่ง + ค่าบริการระบบ)
    let subtotalBeforeDiscount = basePrice + suppliesTotal + deliveryFee + totalPlatformFee;

    // กรณี ก. ลูกค้าทั่วไป (verified_user)
    if (membershipTier === "verified_user") {
      discountAmount = 0;
      discountReason = "none";
    }
    // กรณี ข. สมาชิก - ครั้งแรก (completedOrders === 0)
    else if (completedOrders === 0) {
      discountAmount = deliveryFee;
      deliveryFee = 0;
      discountReason = "first_order_free_delivery";
      subtotalBeforeDiscount = basePrice + suppliesTotal + totalPlatformFee;
    }
    // กรณี ค. สมาชิก - ครั้งที่ 2+ (completedOrders >= 1)
    else {
      // ลด 15% จากยอดรวมทั้งหมด
      discountAmount = Math.round(subtotalBeforeDiscount * 0.15);
      discountReason = "member_15_percent_discount";
    }

    // 8️⃣ คำนวณยอดรวมสุดท้าย
    const totalAmount = subtotalBeforeDiscount - discountAmount;

    return NextResponse.json({
      basePrice,
      suppliesTotal,
      deliveryFee,
      platformFee,
      discountAmount,
      discountReason,
      subtotalBeforeDiscount,
      totalAmount,
      membershipTier,
      completedOrders,
      isFirstOrder: completedOrders === 0,
    });
  } catch (err: any) {
    console.error("❌ Error calculating price:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
