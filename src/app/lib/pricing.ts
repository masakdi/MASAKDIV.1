/* ===== คำนวณราคาออเดอร์ — ใช้ร่วมกันทั้งหน้าสั่งซัก (client) และ /api/orders (server)
   ห้ามแยกสูตรสองที่ ไม่งั้นยอดที่ลูกค้าเห็นกับยอดที่ server บันทึกจะไม่ตรงกัน ===== */

import { priceBedding, type BeddingOrder } from "@/app/lib/bedding";

export type SizeKey = "S" | "M" | "L";
export type ServiceType = "wash_only" | "dry_only" | "wash_and_dry";
export type DeliveryMode = "pickup_only" | "pickup_and_return";

export type BasePriceRow = {
  size: SizeKey;
  svc: ServiceType;
  price_ex_delivery: number;
  breakdown?: any;
};
export type DeliveryFeeRow = {
  mode: DeliveryMode;
  fee_1: number;
  fee_2: number;
  extra_per_basket: number;
  booking_fee_1?: number;
  booking_fee_2?: number;
  booking_extra_per_basket?: number;
};
export type SupplyRow = { key: string; size: string; price: number };

export type Basket = {
  id: number;
  size: SizeKey | "";
  service: ServiceType | "";
  softener: boolean;
  detergent: boolean;
  qty?: number;
};

export type PricingCoupon = {
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  max_discount_amount: number | null;
  end_date: string | null;
};

export const calculateSupplyCharge = (
  size: SizeKey | "",
  softener: boolean,
  detergent: boolean,
  supplies: SupplyRow[] | null,
): number => {
  if (!size || (!softener && !detergent) || !supplies) return 0;

  const softPrice = softener ? (supplies.find(s => s.key === 'softener' && s.size === size)?.price || (size === 'S' ? 10 : 15)) : 0;
  const detPrice = detergent ? (supplies.find(s => s.key === 'detergent' && s.size === size)?.price || (size === 'S' ? 10 : 15)) : 0;

  return Number(softPrice) + Number(detPrice);
};

export const calculatePerSupply = (size: SizeKey | "", picked: boolean, key: 'softener' | 'detergent', supplies: SupplyRow[] | null): number => {
  if (!picked || !size || !supplies) return 0;
  const match = supplies.find(s => s.key === key && s.size === size);
  return match ? Number(match.price) : (size === "S" ? 10 : 15);
};

export const computeWashDry = (basket: Basket, basePrices: BasePriceRow[] | null) => {
  if (!basePrices || !basket.size || !basket.service)
    return { wash: 0, dry: 0, base: 0 };

  if (basket.service === "wash_and_dry") {
    const washRow = basePrices.find(p => p.size === basket.size && p.svc === "wash_only");
    const dryRow = basePrices.find(p => p.size === basket.size && p.svc === "dry_only");

    const wPart = washRow?.price_ex_delivery || 0;
    const dPart = dryRow?.price_ex_delivery || 0;

    return { wash: wPart, dry: dPart, base: wPart + dPart };
  }

  const row = basePrices.find((p) => p.size === basket.size && p.svc === basket.service);
  if (row) {
    const fullPrice = row.price_ex_delivery;
    if (basket.service === "wash_only") return { wash: fullPrice, dry: 0, base: fullPrice };
    if (basket.service === "dry_only") return { wash: 0, dry: fullPrice, base: fullPrice };
    return { wash: fullPrice / 2, dry: fullPrice / 2, base: fullPrice };
  }
  return { wash: 0, dry: 0, base: 0 };
};

/* ค่าส่งแยกต่อตะกร้า (เครื่องนอน 1 รายการ = 1 ตะกร้า) */
export function getDeliveryBreakdown(
  deliveryFees: DeliveryFeeRow[] | null,
  deliveryMode: DeliveryMode,
  count: number,
  orderType: "normal" | "booking",
): number[] {
  const sch = (deliveryFees || []).find((d) => d.mode === deliveryMode);
  const parts = new Array<number>(count).fill(0);
  if (!sch || count === 0) return parts;

  const useBooking = orderType === "booking";
  const f1 = Number(useBooking ? (sch.booking_fee_1 ?? sch.fee_1) : sch.fee_1);
  const f2 = Number(useBooking ? (sch.booking_fee_2 ?? sch.fee_2) : sch.fee_2);
  const extra = Number(useBooking ? (sch.booking_extra_per_basket ?? sch.extra_per_basket) : sch.extra_per_basket);

  if (count === 1) parts[0] = f1;
  else {
    parts[0] = f2 / 2;
    parts[1] = f2 / 2;
    for (let i = 2; i < count; i++) parts[i] = extra;
  }
  return parts;
}

export type PricingInput = {
  isBedding: boolean;
  baskets: Basket[];
  bedding: BeddingOrder;
  orderType: "normal" | "booking";
  deliveryMode: DeliveryMode;
  basePrices: BasePriceRow[];
  deliveryFees: DeliveryFeeRow[];
  supplies: SupplyRow[] | null;
  platformFee: number;
  beddingPrices: Record<string, number> | null;
  membershipTier: string;
  freeDeliveryCount: number;
  coupon: PricingCoupon | null;
  now?: Date;
};

export function computePricing(i: PricingInput) {
  const { isBedding, baskets, bedding, basePrices, supplies, platformFee, membershipTier, freeDeliveryCount, coupon } = i;
  const deliveryBreakdown = getDeliveryBreakdown(
    i.deliveryFees,
    i.deliveryMode,
    isBedding ? bedding.lines.length : baskets.length,
    i.orderType,
  );

  const bedPrice = isBedding && i.beddingPrices ? priceBedding(bedding, i.beddingPrices) : null;
  const bp = isBedding ? (bedPrice?.wash ?? 0) : baskets.reduce((s, b) => {
    let price = 0;
    if (b.service === "wash_and_dry") {
      const w = basePrices.find(p => p.size === b.size && p.svc === "wash_only")?.price_ex_delivery || 0;
      const d = basePrices.find(p => p.size === b.size && p.svc === "dry_only")?.price_ex_delivery || 0;
      price = Number(w) + Number(d);
    } else {
      price = Number(basePrices.find(p => p.size === b.size && p.svc === b.service)?.price_ex_delivery || 0);
    }
    return s + price * (b.qty || 1);
  }, 0);
  const st = isBedding ? (bedPrice?.supplies ?? 0) : baskets.reduce(
    (s, b) => s + calculateSupplyCharge(b.size, b.softener, b.detergent, supplies) * (b.qty || 1),
    0,
  );
  // เครื่องนอน: platform fee 1 ครั้งต่อรายการ (ไม่คูณจำนวนชุด)
  const pf = isBedding
    ? platformFee * bedding.lines.length
    : baskets.reduce((s, b) => s + (b.size && b.service ? platformFee * (b.qty || 1) : 0), 0);

  const df = deliveryBreakdown.reduce((s, f) => s + f, 0);
  // Subtotal Discount calculation (Services + Supplies + Delivery)
  const discountableSubtotal = bp + st + df;

  let mDisc = 0, mLabel = "";
  if (membershipTier !== "verified_user") {
    const percent = membershipTier === "gold" ? 0.20 : 0.15;
    mDisc = Math.round(discountableSubtotal * percent);
    mLabel = `ส่วนลดสมาชิก ${Math.round(percent * 100)}%`;

    if (freeDeliveryCount > 0) {
      mDisc = Math.round((bp + st) * percent) + df;
      mLabel += " + ฟรีค่าส่ง";
    }
  }
  let cDisc = 0, cLabel = "";
  if (coupon) {
    const isExpired = coupon.end_date && new Date(coupon.end_date) < (i.now ?? new Date());
    if (!isExpired) {
      if (coupon.discount_type === "fixed") cDisc = Number(coupon.discount_value);
      else {
        cDisc = Math.round((discountableSubtotal * Number(coupon.discount_value)) / 100);
        if (coupon.max_discount_amount) cDisc = Math.min(cDisc, Number(coupon.max_discount_amount));
      }
      // Cap discount to never exceed the total amount payable
      const maxDiscount = Math.max(0, discountableSubtotal + pf - mDisc);
      if (cDisc > maxDiscount) cDisc = maxDiscount;

      cLabel = `คูปอง ${coupon.code}`;
    }
  }
  const disc = mDisc + cDisc;
  // Grand Total = Discountable items - Discount + Platform Fee
  const gt = Math.max(0, discountableSubtotal - disc + pf);

  const sumBaskets = (f: (b: Basket) => number) => baskets.reduce((s, b) => s + f(b) * (b.qty || 1), 0);
  const summary = {
    wash: isBedding ? bp : sumBaskets((b) => computeWashDry(b, basePrices).wash),
    dry: isBedding ? 0 : sumBaskets((b) => computeWashDry(b, basePrices).dry),
    supplies: st,
    softener: isBedding ? (bedPrice?.softener ?? 0) : sumBaskets((b) => calculatePerSupply(b.size, b.softener, 'softener', supplies)),
    detergent: isBedding ? (bedPrice?.detergent ?? 0) : sumBaskets((b) => calculatePerSupply(b.size, b.detergent, 'detergent', supplies)),
    deliveryBeforeDiscount: df,
    discount: disc,
    discountLabel: [mLabel, cLabel].filter(Boolean).join(" + "),
    platformFee: pf,
    grandTotal: gt,
  };

  return {
    deliveryBreakdown,
    basePrice: bp,
    suppliesTotal: st,
    deliveryFee: df,
    totalPlatformFee: pf,
    grandTotal: gt,
    summary,
  };
}
