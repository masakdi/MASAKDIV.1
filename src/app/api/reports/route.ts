// src/app/api/reports/route.ts
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReportPayload = {
  category: string;
  detail: string;
  contact_phone: string | null;
  image_urls: string[];
};

type RequestBody = {
  payload: ReportPayload;
  consent?: { agreed: boolean; at: string; version: string };
  captchaToken?: string;
};

export async function POST(req: NextRequest) {
  try {
    // ใช้ service role "เฉพาะฝั่งเซิร์ฟเวอร์"
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body: RequestBody = await req.json();
    const { payload, consent } = body;

    // ---- Validation ให้ตรงกับที่ UI จะส่ง ----
    if (!payload || !payload.category || !payload.detail) {
      return new Response(JSON.stringify({ error: "VALIDATION", message: "ข้อมูลไม่ครบถ้วน" }), {
        status: 422, headers: { "Content-Type": "application/json" },
      });
    }
    if (payload.detail.trim().length < 10) {
      return new Response(JSON.stringify({ error: "VALIDATION", message: "รายละเอียดสั้นเกินไป" }), {
        status: 422, headers: { "Content-Type": "application/json" },
      });
    }
    if (!consent || !consent.agreed) {
      return new Response(JSON.stringify({ error: "VALIDATION", message: "กรุณายินยอมเงื่อนไข" }), {
        status: 422, headers: { "Content-Type": "application/json" },
      });
    }

    // ---- Insert เฉพาะฟิลด์ที่มีใน schema ----
    const { data, error } = await supa
      .from("reports")
      .insert({
        category: payload.category,
        detail: payload.detail.trim(),
        contact_phone: payload.contact_phone,
        image_urls: payload.image_urls?.length ? payload.image_urls : [],
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(JSON.stringify({ error: "DATABASE", message: "บันทึกข้อมูลไม่สำเร็จ" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    console.log("✅ Report created:", data.id);

    // ✅ ส่ง Discord notification ทันทีที่สร้างรีพอร์ตสำเร็จ
    try {
      console.log("📤 กำลังส่ง Discord notification สำหรับรีพอร์ตใหม่...");

      const discordResponse = await fetch(`${new URL(req.url).origin}/api/discord/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_report",
          data: data
        })
      });

      if (discordResponse.ok) {
        console.log("✅ Discord notification sent successfully");
      } else {
        console.error("❌ Discord notification failed:", await discordResponse.text());
      }
    } catch (notifyError) {
      console.error("❌ Failed to send Discord notification:", notifyError);
      // ไม่ throw error เพราะรีพอร์ตสร้างสำเร็จแล้ว
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Report API error:", err);
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: "เกิดข้อผิดพลาด" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
