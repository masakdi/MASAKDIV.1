import { NextResponse } from "next/server";
import { supaAdmin } from "../../../../../lib/supabaseAdmin";

const ALLOWED = ["pending", "accepted", "washing", "ready", "delivering", "completed", "cancelled"] as const;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } 
) {
  const { id } = await ctx.params; 

  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const status = body?.status;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  if (status === "completed") {
    const { data, error } = await supaAdmin
      .from("orders")
      .update({ status: "completed" })
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)
      return NextResponse.json(
        { error: "Order already taken or cancelled" },
        { status: 409 }
      );
    return NextResponse.json({ data });
  }

  const { data, error } = await supaAdmin
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
