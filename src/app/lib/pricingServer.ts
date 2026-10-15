/* ===== คำนวณราคาออเดอร์ฝั่ง server (ไม่เชื่อตัวเลขจากหน้าเว็บ) ===== */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_BEDDING,
  toPriceMap,
  usedUnitPrices,
  type BeddingLine,
  type BeddingOrder,
} from "@/app/lib/bedding";
import { computePricing, type Basket, type DeliveryMode, type PricingCoupon } from "@/app/lib/pricing";

const int = (v: unknown, min: number, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

/* เก็บเฉพาะค่าที่ถูกต้อง กันส่งค่าแปลก ๆ มาเพื่อเปลี่ยนราคา */
const sanitizeBaskets = (raw: unknown): Basket[] =>
  (Array.isArray(raw) ? raw : []).map((b: any, i: number) => ({
    id: Number(b?.id) || i,
    size: ["S", "M", "L"].includes(b?.size) ? b.size : "",
    service: ["wash_only", "dry_only", "wash_and_dry"].includes(b?.service) ? b.service : "",
    softener: !!b?.softener,
    detergent: !!b?.detergent,
    qty: int(b?.qty ?? 1, 1, 50),
  }));

const sanitizeBedding = (raw: any): BeddingOrder => ({
  lines: (Array.isArray(raw?.lines) ? raw.lines : [])
    .filter((l: any) => ["3.5", "5-6"].includes(l?.size) && ["thin", "thick"].includes(l?.thickness))
    .map((l: any, i: number): BeddingLine => ({
      id: Number(l.id) || i,
      size: l.size,
      thickness: l.thickness,
      qty: int(l.qty, 1, 50),
    })),
  extra_thin: int(raw?.extra_thin ?? 0, 0, 50),
  extra_thick: int(raw?.extra_thick ?? 0, 0, 50),
  extra_sheet: int(raw?.extra_sheet ?? 0, 0, 50),
  detergent: !!raw?.detergent,
  softener: !!raw?.softener,
});

/* "YYYY-MM-DD" ของวันนี้ตามเวลาไทย */
export const bangkokToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

/* วันจองต้องเป็นพรุ่งนี้ถึงอีก 14 วัน (ตรงกับตัวเลือกในหน้าสั่งซัก) */
export function validateScheduledDate(date: unknown, now = new Date()): string | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "กรุณาเลือกวันจอง";
  const toDays = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
  const diff = toDays(date) - toDays(bangkokToday(now));
  if (diff < 1 || diff > 14) return "วันจองไม่ถูกต้อง กรุณาเลือกวันใหม่";
  return null;
}

type Result =
  | { ok: false; status: number; error: string; message: string }
  | {
      ok: true;
      pricing: ReturnType<typeof computePricing>;
      addons: Record<string, unknown>;
      freeDeliveryUsed: boolean;
    };

export async function priceOrderOnServer(
  supa: SupabaseClient,
  customerId: string,
  body: any,
): Promise<Result> {
  const now = new Date();
  const isBedding = body.addons?.service === "bedding";
  const orderType: "normal" | "booking" = body.order_type === "booking" ? "booking" : "normal";
  const deliveryMode: DeliveryMode =
    body.delivery?.mode === "pickup_only" ? "pickup_only" : "pickup_and_return";

  const [bp, df, sp, pf, bd, user] = await Promise.all([
    supa.from("laundry_base_prices").select("size, svc, price_ex_delivery").eq("active", true),
    supa.from("delivery_fee_schedules").select("*").eq("active", true),
    supa.from("laundry_supplies").select("key, size, price").eq("active", true),
    supa.from("platform_fees").select("amount").eq("fee_type", "standard").single(),
    supa.from("bedding_prices").select("key, price").eq("active", true),
    supa.from("users").select("membership_tier, free_delivery_count").eq("id", customerId).single(),
  ]);
  if (bp.error || df.error || sp.error || user.error) {
    console.error("pricing load failed:", bp.error || df.error || sp.error || user.error);
    return { ok: false, status: 500, error: "pricing_unavailable", message: "โหลดราคาไม่สำเร็จ กรุณาลองใหม่" };
  }
  if (isBedding && (bd.error || !bd.data?.length)) {
    return { ok: false, status: 400, error: "bedding_unavailable", message: "ขณะนี้ยังไม่เปิดบริการซักเครื่องนอน" };
  }

  const membershipTier = user.data?.membership_tier || "verified_user";
  const baskets = isBedding ? [] : sanitizeBaskets(body.addons?.baskets);
  const bedding = isBedding ? sanitizeBedding(body.addons?.bedding) : EMPTY_BEDDING;
  const beddingPrices = bd.data ? toPriceMap(bd.data) : null;

  if (isBedding ? bedding.lines.length === 0 : baskets.length === 0) {
    return { ok: false, status: 400, error: "empty_order", message: "ไม่มีรายการในออเดอร์" };
  }
  if (!isBedding && baskets.some((b) => !b.size || !b.service)) {
    return { ok: false, status: 400, error: "invalid_basket", message: "กรุณาเลือกขนาดและบริการให้ครบทุกตะกร้า" };
  }

  // คูปอง: ต้องเปิดใช้งาน, เริ่มแล้ว, เป็นคูปองสาธารณะหรือผู้ใช้เก็บไว้, และสิทธิ์ตรงกับระดับสมาชิก
  let coupon: (PricingCoupon & { min_order_amount: number }) | null = null;
  if (body.coupon_code) {
    const { data: c } = await supa.from("coupons").select("*").eq("code", String(body.coupon_code)).maybeSingle();
    let available = !!c && c.is_active && (!c.start_date || new Date(c.start_date) <= now);
    if (available && !c.is_public) {
      const { data: uc } = await supa
        .from("user_coupons")
        .select("id")
        .eq("user_id", customerId)
        .eq("coupon_id", c.id)
        .eq("status", "collected")
        .limit(1);
      available = !!uc?.length;
    }
    const roles: string[] = c
      ? typeof c.allowed_roles === "string" ? JSON.parse(c.allowed_roles) : c.allowed_roles || ["all"]
      : [];
    if (!available || !(roles.includes("all") || roles.includes(membershipTier))) {
      return { ok: false, status: 400, error: "invalid_coupon", message: "คูปองนี้ใช้ไม่ได้ กรุณาเลือกคูปองใหม่" };
    }
    coupon = {
      code: c.code,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
      end_date: c.end_date,
      min_order_amount: Number(c.min_order_amount || 0),
    };
  }

  const pricing = computePricing({
    isBedding,
    baskets,
    bedding,
    orderType,
    deliveryMode,
    basePrices: bp.data || [],
    deliveryFees: df.data || [],
    supplies: sp.data || [],
    platformFee: Number(pf.data?.amount ?? 20),
    beddingPrices,
    membershipTier,
    freeDeliveryCount: Number(user.data?.free_delivery_count || 0),
    coupon,
    now,
  });

  if (coupon && pricing.basePrice + pricing.suppliesTotal + pricing.deliveryFee < coupon.min_order_amount) {
    return {
      ok: false,
      status: 400,
      error: "coupon_min_order",
      message: `ยอดไม่ถึงขั้นต่ำของคูปอง (${coupon.min_order_amount} บาท)`,
    };
  }

  const addons = isBedding
    ? {
        ...body.addons,
        service: "bedding",
        baskets: [],
        bedding: { ...bedding, unit_prices: usedUnitPrices(bedding, beddingPrices || {}) },
      }
    : { ...body.addons, baskets };

  return {
    ok: true,
    pricing,
    addons,
    freeDeliveryUsed: pricing.summary.discountLabel.includes("ฟรีค่าส่ง"),
  };
}
