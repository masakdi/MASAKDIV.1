import { NextResponse } from "next/server";
import { supaAdmin } from "@/app/lib/supabaseAdmin";
import { sendDiscordNotification } from "@/app/lib/discord";

/* ===== API: ลูกค้าให้ดาว + คอมเมนต์ออเดอร์ที่เสร็จแล้ว (1 ออเดอร์ / 1 ครั้ง) ===== */
export async function POST(req: Request) {
  try {
    const { user_id, order_id, rating, comment } = await req.json();
    const stars = Number(rating);
    const text = typeof comment === "string" ? comment.trim().slice(0, 500) : "";

    if (!user_id || !order_id) {
      return NextResponse.json({ error: "Missing user_id or order_id" }, { status: 400 });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: "กรุณาให้คะแนน 1-5 ดาว" }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supaAdmin
      .from("orders")
      .select("id, order_number, status, customer_id, contact_name, contact_phone")
      .eq("id", order_id)
      .single();

    if (orderErr || !order || order.customer_id !== user_id) {
      return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
    }
    if (order.status !== "completed") {
      return NextResponse.json({ error: "ให้คะแนนได้เมื่อออเดอร์เสร็จแล้วเท่านั้น" }, { status: 400 });
    }

    const { data: review, error } = await supaAdmin
      .from("order_reviews")
      .insert({ order_id, customer_id: user_id, rating: stars, comment: text || null })
      .select("rating, comment, created_at")
      .single();

    if (error) {
      // unique_violation = รีวิวไปแล้ว
      if (error.code === "23505") {
        return NextResponse.json({ error: "ออเดอร์นี้ให้คะแนนไปแล้ว" }, { status: 409 });
      }
      console.error("Review insert failed:", error);
      return NextResponse.json({ error: "บันทึกรีวิวไม่สำเร็จ" }, { status: 500 });
    }

    // แจ้งแอดมินทาง Discord (ไม่ให้ล้มถ้าส่งไม่ได้)
    await sendDiscordNotification("new_review", { ...order, ...review }).catch(() => {});

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    console.error("Review API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
