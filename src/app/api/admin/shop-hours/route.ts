import { NextResponse } from "next/server";
import { supaAdmin } from "@/app/lib/supabaseAdmin";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ===== API: แอดมินแก้เวลาเปิด-ปิดรับออเดอร์ ===== */
export async function PUT(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { open_time, close_time, cutoff_minutes } = await req.json();
  const cutoff = Number(cutoff_minutes);

  if (!TIME_RE.test(open_time ?? "") || !TIME_RE.test(close_time ?? "")) {
    return NextResponse.json({ error: "รูปแบบเวลาไม่ถูกต้อง (HH:MM)" }, { status: 400 });
  }
  if (open_time === close_time) {
    return NextResponse.json({ error: "เวลาเปิดและปิดต้องไม่เท่ากัน" }, { status: 400 });
  }
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 180) {
    return NextResponse.json({ error: "ปิดรับก่อนเวลาปิดได้ 0-180 นาที" }, { status: 400 });
  }

  const { data, error } = await supaAdmin
    .from("shop_hours")
    .upsert({
      id: 1,
      open_time,
      close_time,
      cutoff_minutes: cutoff,
      updated_at: new Date().toISOString(),
    })
    .select("open_time, close_time, cutoff_minutes")
    .single();

  if (error) {
    console.error("shop_hours update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ hours: data });
}
