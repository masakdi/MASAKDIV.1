import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    let dbQuery = supabase
      .from("users")
      .select("id, nickname, full_name, phone, membership_tier, is_member, membership_expires_at, member_status, free_delivery_count")
      .order("membership_tier", { ascending: false });

    if (query) {
      dbQuery = dbQuery.or(`nickname.ilike.%${query}%,phone.ilike.%${query}%,full_name.ilike.%${query}%`);
    } else {
      // If no query, maybe just show existing members plus some others
      dbQuery = dbQuery.neq("membership_tier", "verified_user");
    }

    const { data, error } = await dbQuery.limit(50);

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Error fetching members:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
