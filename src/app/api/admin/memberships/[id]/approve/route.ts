import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tier, user_id } = await req.json();

    if (!id || !tier || !user_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Update membership request status
    const { error: mError } = await supabase
      .from("memberships")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);

    if (mError) throw mError;

    // 2. Update user tier and expiration (set to 30 days from now)
    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: uError } = await supabase
      .from("users")
      .update({
        membership_tier: tier,
        membership_started_at: startedAt.toISOString(),
        membership_expires_at: expiresAt.toISOString(),
        is_member: true,
        member_status: "approved",
        has_used_free_delivery: false,
        free_delivery_count: tier === "gold" ? 3 : tier === "silver" ? 2 : 1
      })
      .eq("id", user_id);

    if (uError) throw uError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error approving membership:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
