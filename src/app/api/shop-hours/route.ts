import { NextResponse } from "next/server";
import { getShopStatus } from "@/app/lib/shopHours";
import { loadShopHours } from "@/app/lib/shopHoursServer";

export const dynamic = "force-dynamic";

/* ===== API: สถานะเปิด-ปิดรับออเดอร์ (ใช้เวลาเซิร์ฟเวอร์ ไม่เชื่อนาฬิกาเครื่องลูกค้า) ===== */
export async function GET() {
  const hours = await loadShopHours();
  return NextResponse.json(
    { hours, status: getShopStatus(hours) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
