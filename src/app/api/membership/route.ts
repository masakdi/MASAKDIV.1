import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    // --- SYSTEM CHECK: RESET RANK & POINTS ---
    const { checkAndResetMembership } = await import("@/app/lib/membershipManager");
    await checkAndResetMembership(userId);

    // ดึงข้อมูลผู้ใช้พร้อมแต้ม (After potential reset)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, membership_tier, completed_orders_count, membership_started_at, membership_expires_at, nickname, phone, contact_name, contact_phone, contact_address, has_used_free_delivery, free_delivery_count, full_name, gender, birth_date, google_map_link, last_activity_at, last_rank_reset_at, created_at, is_member")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    let updatedUserData = { ...userData };

    // Refresh points data after potential reset
    const { data: pointsData } = await supabase
      .from("user_points")
      .select("total_points, available_points, used_points")
      .eq("user_id", userId)
      .single();

    // ดึงข้อมูล tier
    const { data: tierData } = await supabase
      .from("membership_tiers")
      .select("*")
      .eq("tier_name", updatedUserData.membership_tier || "verified_user")
      .single();

    return NextResponse.json({
      user: updatedUserData,
      points: pointsData || { total_points: 0, available_points: 0, used_points: 0 },
      tier: tierData,
      server_time: now.toISOString() // Return server time for accurate countdown
    });
  } catch (err: any) {
    console.error("❌ Error fetching membership:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
