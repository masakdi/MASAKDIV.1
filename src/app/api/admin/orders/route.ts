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

export async function DELETE(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Validate Env Vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
     console.error("Missing Supabase Env Vars in API");
     return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "invalid ids" }, { status: 400 });
    }

    console.log(`Attempting to delete ${ids.length} orders...`);

    // Batch delete to avoid URL length issues or Timeouts
    const BATCH_SIZE = 20;
    const errors = [];
    let deletedCount = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);

        console.log(`Cleaning up constraints for chunk ${i}...`);

        // 1. Unlink Coupons (Set order_id to NULL)
        const { error: couponError } = await supaAdmin
            .from("user_coupons")
            .update({ order_id: null, status: 'collected' }) // Resetting status to collected as well to "return" the coupon effectively, or just unlink. Safest for "deleted" order is to return it or at least unlink.
            .in("order_id", chunk);

        if (couponError) {
             console.error("Error unlinking coupons:", couponError);
             // We continue? Or stop? If we don't fix this, delete will fail.
        }

        // 2. Unlink Point Transactions
        const { error: pointError } = await supaAdmin
            .from("point_transactions")
            .update({ order_id: null })
            .in("order_id", chunk);

        if (pointError) {
            console.error("Error unlinking points:", pointError);
        }

        // 3. Delete Orders
        const { error, count } = await supaAdmin
          .from("orders")
          .delete({ count: 'exact' })
          .in("id", chunk);

        if (error) {
           console.error(`Batch delete failed for chunk ${i}:`, error);
           errors.push(error);
        } else {
           deletedCount += (count || 0); 
           // If count is not supported by the specific supabase version/config, usage of chunk.length is a fallback estimation 
           if (count === null || count === undefined) deletedCount += chunk.length;
        }
    }

    if (errors.length > 0) {
      // If all failed
      if (errors.length === Math.ceil(ids.length / BATCH_SIZE)) {
         return NextResponse.json({ error: "All batch deletes failed. Check server logs." }, { status: 500 });
      }
      // Partial success
      return NextResponse.json({ 
          success: true, 
          message: "Some items failed to delete", 
          deletedCount, 
          errors: errors.map(e => e.message) 
      });
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (err: any) {
    console.error("DELETE API Critical Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
