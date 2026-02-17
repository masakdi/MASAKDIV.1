import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const token = req.headers.get("x-admin-token");
  
  if (!token) {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // Hard delete
  const { error } = await supaAdmin
    .from("orders")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete order error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
