import { supaAdmin } from "@/app/lib/supabaseAdmin";
import { DEFAULT_SHOP_HOURS, type ShopHours } from "@/app/lib/shopHours";

/* โหลดเวลาเปิด-ปิด (server เท่านั้น) ถ้ายังไม่มีตาราง/แถว ใช้ค่าเริ่มต้น 09:00-18:00 */
export async function loadShopHours(): Promise<ShopHours> {
  const { data, error } = await supaAdmin
    .from("shop_hours")
    .select("open_time, close_time, cutoff_minutes")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("shop_hours fetch failed:", error);
    return DEFAULT_SHOP_HOURS;
  }
  return data as ShopHours;
}
