import { NextResponse } from "next/server";
import { supaAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/* ===== API: รีวิวทั้งหมดสำหรับหลังบ้าน (CRM) ===== */
export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: reviews, error } = await supaAdmin
    .from("order_reviews")
    .select("id, order_id, customer_id, rating, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // แนบข้อมูลออเดอร์ (เลขออเดอร์ / ชื่อ / เบอร์ / ยอด)
  const orderIds = (reviews || []).map((r) => r.order_id);
  const { data: orders, error: ordersError } = orderIds.length
    ? await supaAdmin
        .from("orders")
        .select("id, order_number, contact_name, contact_phone, created_at, total_amount")
        .in("id", orderIds)
    : { data: [], error: null };

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const orderMap = new Map((orders || []).map((o) => [o.id, o]));
  const data = (reviews || []).map((r) => ({ ...r, order: orderMap.get(r.order_id) ?? null }));

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
