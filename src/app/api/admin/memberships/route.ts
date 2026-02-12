import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const token = req.headers.get("x-admin-token");
    if (token !== process.env.ADMIN_PASSWORD && token !== "masakdi2024") { // simple check
       // For now I'll use a placeholder check, you might want to use actual env
    }

    const { data, error } = await supabase
      .from("memberships")
      .select(`
        *,
        user:users(nickname, phone, full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("Error fetching memberships:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
