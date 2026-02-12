import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { 
      membership_tier, 
      membership_expires_at, 
      is_member, 
      member_status,
      free_delivery_count
    } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const updateData: any = {
      membership_tier,
      is_member,
      member_status
    };

    if (free_delivery_count !== undefined) {
      updateData.free_delivery_count = free_delivery_count;
    }

    // Every time admin adjusts rank, reset free delivery count
    if (membership_tier !== undefined) {
      updateData.free_delivery_count = 
        membership_tier === "gold" ? 3 : 
        membership_tier === "silver" ? 2 : 
        membership_tier === "member" ? 1 : 0;
    }

    if (membership_expires_at) {
      updateData.membership_expires_at = membership_expires_at;
    } else if (membership_tier === "verified_user") {
      updateData.membership_expires_at = null;
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Error updating member tier:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
