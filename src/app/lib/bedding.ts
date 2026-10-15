/* ===== ซักเครื่องนอน: ชนิดข้อมูล + คำนวณราคา (ราคามาจากตาราง bedding_prices) ===== */

export type BeddingSize = "3.5" | "5-6";
export type BeddingThickness = "thin" | "thick";

export type BeddingLine = {
  id: number;
  size: BeddingSize;
  thickness: BeddingThickness;
  qty: number; // จำนวนชุด
};

export type BeddingOrder = {
  lines: BeddingLine[];
  extra_thin: number; // เพิ่มผ้าห่มบาง (ผืน)
  extra_thick: number; // เพิ่มผ้าห่ม/ผ้านวมหนา (ผืน)
  extra_sheet: number; // เพิ่มผ้าปู/ปลอกหมอน (ฟรี)
  detergent: boolean;
  softener: boolean;
};

/* สิ่งที่เก็บลง orders.addons.bedding — มีราคาต่อหน่วย ณ ตอนสั่ง */
export type BeddingSnapshot = BeddingOrder & { unit_prices: Record<string, number> };

export type BeddingPriceRow = {
  id: string;
  key: string;
  label: string;
  price: number;
  sort_order: number;
};

export const EMPTY_BEDDING: BeddingOrder = {
  lines: [],
  extra_thin: 0,
  extra_thick: 0,
  extra_sheet: 0,
  detergent: false,
  softener: false,
};

export const BEDDING_SIZE_LABEL: Record<BeddingSize, string> = {
  "3.5": "3.5 ฟุต",
  "5-6": "5-6 ฟุต",
};

export const BEDDING_THICKNESS_LABEL: Record<BeddingThickness, string> = {
  thin: "แบบบาง",
  thick: "แบบหนา",
};

export const setKey = (size: BeddingSize, thickness: BeddingThickness) =>
  `set_${size}_${thickness}`;

export const toPriceMap = (rows: Pick<BeddingPriceRow, "key" | "price">[]) =>
  Object.fromEntries(rows.map((r) => [r.key, Number(r.price)])) as Record<string, number>;

/* ราคาที่ใช้ในออเดอร์นี้เท่านั้น — เก็บเป็น snapshot ในออเดอร์ */
export const usedUnitPrices = (o: BeddingOrder, prices: Record<string, number>) => {
  const keys = new Set(o.lines.map((l) => setKey(l.size, l.thickness)));
  if (o.extra_thin > 0) keys.add("extra_thin_blanket");
  if (o.extra_thick > 0) keys.add("extra_thick_blanket");
  if (o.detergent) keys.add("detergent");
  if (o.softener) keys.add("softener");
  return Object.fromEntries([...keys].map((k) => [k, prices[k] ?? 0]));
};

/* คำนวณราคา: ค่าซัก (ชุด + ผ้าห่มเพิ่ม) และค่าน้ำยา (คิดครั้งเดียวต่อออเดอร์) */
export function priceBedding(o: BeddingOrder, prices: Record<string, number>) {
  const p = (k: string) => Number(prices[k] ?? 0);
  const lines = o.lines.map((l) => {
    const unit = p(setKey(l.size, l.thickness));
    return { ...l, unit, total: unit * l.qty };
  });
  const extraThin = o.extra_thin * p("extra_thin_blanket");
  const extraThick = o.extra_thick * p("extra_thick_blanket");
  const detergent = o.detergent ? p("detergent") : 0;
  const softener = o.softener ? p("softener") : 0;
  const wash = lines.reduce((s, l) => s + l.total, 0) + extraThin + extraThick;
  return { lines, extraThin, extraThick, detergent, softener, wash, supplies: detergent + softener };
}

export const isBeddingOrder = (addons: any) => addons?.service === "bedding";

/* ข้อความสรุปรายการเครื่องนอน ใช้ใน Discord / หลังบ้าน / ประวัติ */
export function describeBedding(b: BeddingSnapshot | undefined | null): string[] {
  if (!b) return [];
  const price = (k: string) => b.unit_prices?.[k];
  const baht = (n?: number) => (n === undefined ? "" : ` (${n} บาท)`);
  const out = (b.lines || []).map(
    (l) =>
      `ชุดเครื่องนอน ${BEDDING_SIZE_LABEL[l.size]} ${BEDDING_THICKNESS_LABEL[l.thickness]} x${l.qty}${baht(
        price(setKey(l.size, l.thickness)),
      )}`,
  );
  if (b.extra_thin > 0) out.push(`เพิ่มผ้าห่มแบบบาง x${b.extra_thin}${baht(price("extra_thin_blanket"))}`);
  if (b.extra_thick > 0) out.push(`เพิ่มผ้าห่ม/ผ้านวมแบบหนา x${b.extra_thick}${baht(price("extra_thick_blanket"))}`);
  if (b.extra_sheet > 0) out.push(`เพิ่มผ้าปู/ปลอกหมอน x${b.extra_sheet} (ฟรี)`);
  const liquids = [b.detergent && "ผงซักฟอก", b.softener && "ปรับผ้านุ่ม"].filter(Boolean);
  out.push(`น้ำยา: ${liquids.length ? liquids.join(", ") : "ไม่มี"}`);
  return out;
}

/* ค่าน้ำยาของออเดอร์เครื่องนอน (จาก snapshot) สำหรับรายงานหลังบ้าน */
export const beddingSupplies = (addons: any) => {
  const b = addons?.bedding;
  const p = b?.unit_prices || {};
  return {
    detergent: b?.detergent ? Number(p.detergent || 0) : 0,
    softener: b?.softener ? Number(p.softener || 0) : 0,
  };
};
