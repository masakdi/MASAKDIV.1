import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { line_id } = await req.json();

    if (!line_id) {
      return NextResponse.json({ error: "Missing line_id" }, { status: 400 });
    }

    console.log("🔍 ตรวจสอบผู้ใช้ LINE ID:", line_id);

    // 1. เช็ค public.users
    const { data: publicUser } = await admin
      .from("users")
      .select("*")
      .eq("line_user_id", line_id)
      .maybeSingle();

    console.log("📊 Public user:", publicUser);

    // 2. เช็ค auth.users
    const email = `line_${line_id}@line.local`;
    const { data: allAuthUsers } = await admin.auth.admin.listUsers();
    const authUser = allAuthUsers.users.find((u: any) => u.email === email);

    console.log("🔐 Auth user:", authUser ? { id: authUser.id, email: authUser.email } : null);

    // 3. สรุป
    const summary = {
      line_id,
      has_public_user: !!publicUser,
      has_auth_user: !!authUser,
      public_user_id: publicUser?.id || null,
      auth_user_id: authUser?.id || null,
      match: publicUser?.id === authUser?.id,
    };

    console.log("📋 สรุป:", summary);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
