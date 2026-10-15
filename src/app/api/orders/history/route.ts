import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ===== API: ดึงประวัติออเดอร์ของผู้ใช้ ===== */
export async function POST(req: Request) {
  try {
    /* ===== Supabase Server Client ===== */
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // ใช้ Service Role เพื่ออ่านทุก user
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // ✅ ดึง orders ของ user โดยตรง
    const { data: orders, error: ordersError } = await supa
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        base_price,
        supplies_total,
        delivery_fee,
        created_at,
        note,
        addons
      `)
      .eq("customer_id", user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (ordersError) {
      console.error("Orders fetch failed:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    // ✅ แนบรีวิว (query แยก เพื่อไม่ให้ประวัติพังถ้ายังไม่มีตาราง order_reviews)
    const ids = (orders || []).map((o) => o.id);
    const reviewsByOrder: Record<string, unknown> = {};
    if (ids.length > 0) {
      const { data: reviews, error: reviewsError } = await supa
        .from("order_reviews")
        .select("order_id, rating, comment, created_at")
        .in("order_id", ids);
      if (reviewsError) console.error("Reviews fetch failed:", reviewsError);
      for (const r of reviews || []) {
        const { order_id, ...rest } = r;
        reviewsByOrder[order_id] = rest;
      }
    }

    return NextResponse.json(
      {
        orders: (orders || []).map((o) => ({ ...o, review: reviewsByOrder[o.id] ?? null })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Order history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
