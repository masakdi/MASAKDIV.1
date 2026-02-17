import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json(
        { error: "ไม่พบ order_id" },
        { status: 400 }
      );
    }

    console.log("🔄 กำลังยกเลิกออเดอร์:", order_id);

    // ตรวจสอบสถานะปัจจุบัน
    const { data: currentOrder, error: fetchError } = await supabase
      .from("orders")
      .select("status, customer_id")
      .eq("id", order_id)
      .single();

    if (fetchError) {
      console.error("❌ ไม่พบออเดอร์:", fetchError);
      return NextResponse.json(
        { error: "ไม่พบออเดอร์" },
        { status: 404 }
      );
    }

    // อนุญาตให้ยกเลิกได้เฉพาะสถานะ pending และ accepted
    if (!["pending", "accepted"].includes(currentOrder.status)) {
      return NextResponse.json(
        { error: "ไม่สามารถยกเลิกออเดอร์นี้ได้ (สถานะดำเนินการไปแล้ว)" },
        { status: 400 }
      );
    }

    // อัพเดทสถานะเป็น cancelled
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order_id)
      .select()
      .single();

    if (error) {
      console.error("❌ อัพเดทสถานะล้มเหลว:", error);
      return NextResponse.json(
        { error: "ยกเลิกออเดอร์ไม่สำเร็จ" },
        { status: 500 }
      );
    }

    console.log("✅ ยกเลิกออเดอร์สำเร็จ:", order_id);

    // ✅ ส่ง Discord notification โดยตรง
    try {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

      if (webhookUrl) {
        console.log("📤 กำลังส่ง Discord notification สำหรับการยกเลิกออเดอร์...");

        const embed = {
          title: "❌ ลูกค้ายกเลิกออเดอร์",
          color: 0xEF4444, // สีแดง
          description: `ออเดอร์ **${data.order_number || data.id.slice(0, 8)}** ถูกยกเลิกโดยลูกค้า`,
          fields: [
            { name: "👤 ชื่อลูกค้า", value: data.contact_name || "-", inline: true },
            { name: "📞 เบอร์โทร", value: data.contact_phone || "-", inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "MASAKDI Admin System" },
        };

        const discordResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [embed],
            username: "MASAKDI Bot",
          }),
        });

        if (discordResponse.ok) {
          console.log("✅ Discord notification sent successfully");
        } else {
          const errorText = await discordResponse.text();
          console.error("❌ Discord API error:", discordResponse.status, errorText);
        }
      } else {
        console.warn("⚠️ DISCORD_WEBHOOK_URL not configured");
      }
    } catch (notifyError) {
      console.error("❌ Failed to send Discord notification:", notifyError);
      // ไม่ throw error เพราะออเดอร์ยกเลิกสำเร็จแล้ว
    }

    return NextResponse.json({
      success: true,
      order: data,
    });
  } catch (error: any) {
    console.error("❌ เกิดข้อผิดพลาดในการยกเลิกออเดอร์:", error);
    return NextResponse.json(
      { error: error.message || "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
