import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* =========================
   ✅ เพิ่มตรงนี้ (GET)
   ========================= */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // รับ code / state ไว้ (ไม่จำเป็นต้องใช้)
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // redirect กลับหน้าเว็บหลัก
  return NextResponse.redirect(new URL("/", url.origin));
}

/* =========================
   POST (ของเดิมคุณ)
   ========================= */
export async function POST(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { line_id, name, picture } = await req.json();
    if (!line_id)
      return NextResponse.json({ error: "Missing line_id" }, { status: 400 });

    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("line_user_id", line_id)
      .maybeSingle();

    if (existing)
      return NextResponse.json({ existing: true, user_id: existing.id });

    const email = `line_${line_id.toLowerCase()}@line.local`;
    let authUserId: string | null = null;

    const { data: newAuth, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: { line_user_id: line_id, name, picture },
      });

    if (createErr) {
      if (createErr.code === "email_exists") {
        let page = 1;
        let found = null;

        do {
          const { data } = await admin.auth.admin.listUsers({
            page,
            perPage: 100,
          });
          found = data.users.find(
            (u: any) => u.email?.toLowerCase() === email.toLowerCase()
          );
          page++;
        } while (!found);

        authUserId = found.id;
      } else {
        throw createErr;
      }
    } else {
      authUserId = newAuth.user.id;
    }

    const { error: insertErr } = await admin.from("users").insert({
      id: authUserId,
      line_user_id: line_id,
      full_name: name,
      avatar_url: picture,
    });

    if (insertErr) throw insertErr;

    return NextResponse.json({ created: true, user_id: authUserId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
