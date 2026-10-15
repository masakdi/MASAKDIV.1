/* ===== เวลาเปิด-ปิดรับออเดอร์ (ใช้ได้ทั้ง client และ server) ===== */

export type ShopHours = {
  open_time: string; // "HH:MM" หรือ "HH:MM:SS" จาก Postgres
  close_time: string;
  cutoff_minutes: number; // ปิดรับก่อนเวลาปิดจริงกี่นาที
};

export type ShopStatus = {
  isOpen: boolean;
  openLabel: string; // เวลาเปิด
  closeLabel: string; // เวลาปิดจริงของร้าน
  lastOrderLabel: string; // เวลาปิดรับออเดอร์จริง (ปิด - cutoff)
};

export const DEFAULT_SHOP_HOURS: ShopHours = {
  open_time: "09:00",
  close_time: "18:00",
  cutoff_minutes: 15,
};

const DAY = 24 * 60;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toLabel = (min: number) => {
  const m = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* นาทีของวันตามเวลาไทย ไม่ขึ้นกับ timezone ของเครื่อง/เซิร์ฟเวอร์ */
const bangkokMinutes = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

export function getShopStatus(hours: ShopHours, now: Date = new Date()): ShopStatus {
  const open = toMinutes(hours.open_time);
  const close = toMinutes(hours.close_time);
  const lastOrder = (close - Number(hours.cutoff_minutes || 0) + DAY) % DAY;
  const cur = bangkokMinutes(now);

  // รองรับกรณีปิดข้ามเที่ยงคืน (เช่น 18:00 - 02:00)
  const isOpen =
    open <= lastOrder
      ? cur >= open && cur < lastOrder
      : cur >= open || cur < lastOrder;

  return {
    isOpen,
    openLabel: toLabel(open),
    closeLabel: toLabel(close),
    lastOrderLabel: toLabel(lastOrder),
  };
}

export const closedMessage = (s: ShopStatus) =>
  `ขณะนี้ปิดรับออเดอร์สั่งด่วน เปิดรับเวลา ${s.openLabel} - ${s.lastOrderLabel} น. (ร้านปิด ${s.closeLabel} น.) แต่ยังจองล่วงหน้าได้ตามปกติ`;
