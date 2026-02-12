import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { user_id, tier, slip_url, amount, nickname, phone, contact_address } = await req.json();

    if (!user_id || !tier || !slip_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. อัปเดตข้อมูลผู้ใช้ (Source of Truth)
    await supabase.from("users").update({
      nickname,
      phone,
      contact_address
    }).eq("id", user_id);

    // 2. บันทึกคำขอซื้อสมาชิก
    const { data, error } = await supabase
      .from("memberships")
      .insert({
        user_id,
        slip_url,
        amount,
        status: "pending",
        metadata: { requested_tier: tier } 
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving purchase request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Purchase request submitted",
      data
    });
  } catch (err: any) {
    console.error("Error in membership purchase:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
