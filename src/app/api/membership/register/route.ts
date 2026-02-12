import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const {
      user_id,
      first_name,
      last_name,
      nickname,
      phone,
      gender,
      birth_date,
      address,
      google_map_link,
      slip_url,
    } = await req.json();

    // Validate required fields
    if (!user_id || !first_name || !last_name || !nickname || !phone || !gender || !birth_date || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. อัพเดทข้อมูลผู้ใช้
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        full_name: `${first_name} ${last_name}`,
        nickname: nickname,
        phone: phone,
        contact_name: `${first_name} ${last_name}`,
        contact_phone: phone,
        contact_address: address,
        membership_tier: "verified_user", 
        membership_started_at: null,
        gender: gender,
        birth_date: birth_date,
        google_map_link: google_map_link || null,
        is_member: false,
        member_status: slip_url ? "pending" : "none",
      })
      .eq("id", user_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. ถ้ามีสลิป ให้สร้างคำขอใน memberships
    if (slip_url) {
      const { error: memberError } = await supabase
        .from("memberships")
        .insert({
          user_id,
          slip_url,
          amount: 59,
          status: "pending",
          metadata: { requested_tier: "member" }
        });
      
      if (memberError) {
        console.error("Error creating membership request:", memberError);
        // Note: We don't fail the whole registration if this fails, but it's not ideal.
      }
    }

    return NextResponse.json({
      success: true,
      message: slip_url ? "Registration and payment submitted" : "Registration successful",
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Error in membership registration:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
