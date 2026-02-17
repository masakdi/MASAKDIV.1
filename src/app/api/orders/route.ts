import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDiscordNotification } from "@/app/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ✅ ใช้ service role key เพื่อ bypass RLS
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();

    // ✅ ตรวจค่าที่จำเป็นต้องมี
    if (!body.contact_name || !body.contact_phone) {
      return NextResponse.json(
        { error: "missing contact_name or contact_phone" },
        { status: 400 }
      );
    }

    // ⚠️ ตรวจสอบว่ามี customer_id หรือไม่
    if (!body.customer_id) {
      console.error("❌ ไม่มี customer_id - ผู้ใช้ยังไม่ได้ลงทะเบียน");
      return NextResponse.json(
        { error: "customer_id is required - user not registered" },
        { status: 400 }
      );
    }

    // ✅ 0. Silent System Check (Auto-Reset Rank/Points before Order)
    const { checkAndResetMembership } = await import("@/app/lib/membershipManager");
    await checkAndResetMembership(body.customer_id);

    // ✅ ตรวจสอบว่า customer_id มีอยู่จริงในตาราง users
    const { data: userExists, error: userCheckErr } = await supa
      .from("users")
      .select("id")
      .eq("id", body.customer_id)
      .single();

    if (userCheckErr || !userExists) {
      console.error("❌ ไม่พบผู้ใช้ในระบบ:", body.customer_id);
      return NextResponse.json(
        { error: "customer not found in database" },
        { status: 404 }
      );
    }

    console.log("✅ ยืนยันผู้ใช้:", body.customer_id);

    // ✅ เตรียม payload ให้ตรงกับตาราง orders
    const payload = {
      customer_id: body.customer_id, // บังคับต้องมี
      status: body.status ?? "accepted", // เปลี่ยนจาก pending เป็น accepted
      base_price: body.base_price ?? 0,
      supplies_total: body.supplies_total ?? 0,
      delivery_fee: body.delivery_fee ?? 0,
      platform_fee: body.platform_fee ?? 0,
      discount_amount: body.discount_amount ?? 0,
      discount_reason: body.discount_reason ?? null,
      subtotal_before_discount: body.subtotal_before_discount ?? 0,
      delivery: body.delivery ?? null,       // jsonb
      addons: body.addons ?? null,           // jsonb
      note: body.note ?? null,
      slip_url: body.slip_url ?? null,
      contact_name: body.contact_name?.trim(),
      contact_phone: body.contact_phone?.replace(/\D/g, ""),
      order_type: body.order_type || 'normal',
      scheduled_date: body.scheduled_date || null,
      wash_price: body.wash_price ?? 0,
      dry_price: body.dry_price ?? 0,
    };

    // ✅ insert ลงตาราง orders
    const { data, error } = await supa
      .from("orders")
      .insert([payload])
      .select("id, order_number, status, created_at")
      .single();

    if (error) {
      console.error("❌ Order creation failed:", error);
      return NextResponse.json(
        { error: "failed_to_create_order", details: error.message },
        { status: 500 }
      );
    }

    // ✅ หักจำนวนสิทธิ์ส่งฟรี และอัปเดตข้อมูลไฟล์ผู้ใช้ (Source of Truth)
    const userUpdate: any = {
      nickname: payload.contact_name,
      phone: payload.contact_phone,
      contact_address: body.delivery?.address || null,
      google_map_link: body.delivery?.google_map_link || null,
    };

    if (payload.discount_reason?.includes("ฟรีค่าส่ง")) {
      const { data: userData } = await supa
        .from("users")
        .select("free_delivery_count")
        .eq("id", payload.customer_id)
        .single();
      
      const currentCount = userData?.free_delivery_count || 0;
      userUpdate.has_used_free_delivery = true; // Legacy
      userUpdate.free_delivery_count = Math.max(0, currentCount - 1); // New
    }

    // Update last activity timestamp
    userUpdate.last_activity_at = new Date().toISOString();

    await supa
      .from("users")
      .update(userUpdate)
      .eq("id", payload.customer_id);

    console.log("✅ Order created:", data);

    // ✅ ส่ง Discord notification ทันทีที่สร้างออเดอร์สำเร็จ
    try {
      // ดึงข้อมูลออเดอร์ที่สมบูรณ์เพื่อส่ง Discord พร้อมข้อมูลสมาชิก
      const { data: fullOrder } = await supa
        .from("orders")
        .select(`
          *,
          users:customer_id ( membership_tier )
        `)
        .eq("id", data.id)
        .single();

      if (fullOrder) {
        const total = (fullOrder.base_price || 0) + (fullOrder.supplies_total || 0) + (fullOrder.delivery_fee || 0) + (fullOrder.platform_fee || 0) - (fullOrder.discount_amount || 0);

        // ดึง membership_tier จากข้อมูลที่ join มา
        const membershipTier = (fullOrder as any).users?.membership_tier || "verified_user";

        console.log("📤 กำลังส่ง Discord notification สำหรับออเดอร์ใหม่...");

        const result = await sendDiscordNotification("new_order", { 
          ...fullOrder, 
          total, 
          membership_tier: membershipTier,
          wash_price: body.wash_price,
          dry_price: body.dry_price
        });

        if (result.success) {
          console.log("✅ Discord notification sent successfully");
        } else {
          console.error("❌ Discord notification failed:", result.error);
        }
      }
    } catch (notifyError) {
      console.error("❌ Failed to send Discord notification:", notifyError);
      // ไม่ throw error เพราะออเดอร์สร้างสำเร็จแล้ว
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
