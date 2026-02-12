import { NextResponse } from "next/server";
import { supaAdmin } from "../../../lib/supabaseAdmin";

export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
 

  const { data, error } = await supaAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
   

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
