import { NextResponse } from "next/server";
import { supaAdmin } from "@/app/lib/supabaseAdmin";

export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: basePrices, error: err1 } = await supaAdmin.from("laundry_base_prices").select("*").order("svc").order("size");
  const { data: supplies, error: err2 } = await supaAdmin.from("laundry_supplies").select("*").order("key");
  const { data: platformFees, error: err3 } = await supaAdmin.from("platform_fees").select("*").eq("active", true);

  if (err1 || err2 || err3) {
    return NextResponse.json({ error: err1?.message || err2?.message || err3?.message }, { status: 500 });
  }

  return NextResponse.json({ basePrices, supplies, platformFees });
}

export async function PATCH(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { type, id, updates } = await req.json();
  
  let table = "";
  if (type === "basePrice") table = "laundry_base_prices";
  else if (type === "supply") table = "laundry_supplies";
  else if (type === "platformFee") table = "platform_fees";

  if (!table) return NextResponse.json({ error: "invalid type" }, { status: 400 });

  const { error } = await supaAdmin.from(table).update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { type, data } = await req.json();
  const table = type === "basePrice" ? "laundry_base_prices" : "laundry_supplies";

  const { error } = await supaAdmin.from(table).insert(data);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
