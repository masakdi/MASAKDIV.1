import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    console.log("🔄 กำลังอัพเดทออเดอร์ที่มีสถานะ pending ทั้งหมดเป็น accepted...");

    // อัพเดทออเดอร์ทั้งหมดที่เป็น pending ให้เป็น accepted
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "accepted" })
      .eq("status", "pending")
      .select("id, order_number");

    if (error) {
      console.error("❌ อัพเดทล้มเหลว:", error);
      return NextResponse.json(
        { error: "อัพเดทล้มเหลว", details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ อัพเดทสำเร็จ ${data?.length || 0} ออเดอร์`);

    return NextResponse.json({
      success: true,
      message: `อัพเดทสำเร็จ ${data?.length || 0} ออเดอร์`,
      updated_orders: data,
    });
  } catch (error: any) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
