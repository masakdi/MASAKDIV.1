import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Reset all users who are not 'verified_user' back to 'verified_user'
    // or reset based on logic. The user said "All member ranks".
    const { error } = await supabase
      .from("users")
      .update({
        membership_tier: "verified_user",
        membership_expires_at: null,
        is_member: false,
        member_status: "none",
        free_delivery_count: 0
      })
      .not("membership_tier", "eq", "verified_user");

    if (error) throw error;

    return NextResponse.json({ success: true, message: "All membership ranks have been reset." });
  } catch (err: any) {
    console.error("Error resetting memberships:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
