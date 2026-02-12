"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import liff from "@line/liff";
import { supa } from "@/app/lib/supabaseClient";
// ถ้าต้องการ toast แนะนำติดตั้ง react-hot-toast (ไม่บังคับ)
// import { toast } from "react-hot-toast";

/* ===== Types ===== */
type SizeKey = "S" | "M" | "L" | "";
type ServiceType = "wash_only" | "dry_only" | "wash_and_dry" | "";

type Basket = {
  id?: string | number;
  size?: SizeKey;
  service?: ServiceType;
  qty?: number;
  softener?: boolean | number;
  detergent?: boolean | number;
};

type OrderItem = {
  id: string;
  order_number?: string | null;
  created_at: string;
  status: string;
  base_price?: number | null;
  supplies_total?: number | null;
  delivery_fee?: number | null;
  delivery?: { breakdown?: number[] } | any;
  addons?: { baskets?: Basket[] } | null;
  note?: string | null;
};

type BasePriceRow = {
  size: SizeKey;
  svc: Exclude<ServiceType, "">;
  price_ex_delivery: number;
  breakdown?: any;
};

/* ===== Utils ===== */
const formatBaht = (n?: number | null) =>
  (Number(n ?? 0)).toLocaleString("th-TH") + " บาท";

const formatDate = (ts: string) =>
  new Date(ts).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusBadge = (s?: string) => {
  const k = (s || "").toLowerCase();
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "รอรับงาน", cls: "bg-amber-100 text-amber-800" },
    accepted: { text: "รับงานแล้ว", cls: "bg-green-100 text-green-800" },
    confirmed: { text: "ยืนยันแล้ว", cls: "bg-sky-100 text-sky-800" },
    in_progress: { text: "กำลังซัก", cls: "bg-purple-100 text-purple-800" },
    completed: { text: "เสร็จแล้ว", cls: "bg-emerald-100 text-emerald-800" },
    cancelled: { text: "ยกเลิก", cls: "bg-rose-100 text-rose-800" },
  };
  return map[k] || { text: s || "ไม่ระบุ", cls: "bg-slate-100 text-slate-800" };
};

/* ===== Pricing ===== */
const calculatePerSupply = (size: SizeKey | "", picked: boolean | number): number => {
  if (!picked || !size) return 0;
  if (typeof picked === "number") return Number(picked);
  return size === "S" ? 10 : size === "M" || size === "L" ? 15 : 0;
};

const computeWashDry = (basket: Basket, basePrices: BasePriceRow[] | null) => {
  if (!basePrices || !basket.size || !basket.service)
    return { wash: 0, dry: 0, base: 0 };

  const row = basePrices.find(
    (p) => p.size === basket.size && p.svc === basket.service
  );
  if (row) {
    if (basket.service === "wash_only")
      return { wash: row.price_ex_delivery, dry: 0, base: row.price_ex_delivery };
    if (basket.service === "dry_only")
      return { wash: 0, dry: row.price_ex_delivery, base: row.price_ex_delivery };
    const bd = row.breakdown || {};
    const half = ((bd.commission as number) || 0) / 2;
    const wash = (bd.wash || 0) + half || row.price_ex_delivery / 2;
    const dry = (bd.dry || 0) + half || row.price_ex_delivery / 2;
    return { wash, dry, base: row.price_ex_delivery };
  }
  return { wash: 0, dry: 0, base: 0 };
};

const getDeliveryShare = (order: OrderItem, idx: number, count: number) => {
  const fee = Number(order.delivery_fee ?? 0);
  if (Array.isArray(order.delivery?.breakdown)) {
    const v = Number(order.delivery.breakdown[idx] ?? 0);
    return isFinite(v) ? v : 0;
  }
  return count <= 0 || fee <= 0 ? 0 : fee / count;
};

/* ===== Component ===== */
export default function HistoryOrders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [basePrices, setBasePrices] = useState<BasePriceRow[] | null>(null);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const toggleRow = (id: string) =>
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));

  useLayoutEffect(() => {
    document.body.style.backgroundColor = "white";
  }, []);

  /* ===== Load base prices ===== */
  useEffect(() => {
    async function loadBase() {
      const { data, error } = await supa
        .from("laundry_base_prices")
        .select("size, svc, price_ex_delivery, breakdown")
        .eq("active", true);
      if (!error && data) {
        setBasePrices(data as BasePriceRow[]);
      } else {
        console.error("fetch base price error", error);
      }
    }
    loadBase();
  }, []);

  /* ===== Load orders ===== */
  const loadOrders = async (uid: string) => {
    try {
      const res = await fetch("/api/orders/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");
      setOrders(data.orders || []);
    } catch (e) {
      console.error("loadOrders error:", e);
      setError("ระบบขัด ข้อง กรุณาลองใหม่ภายหลัง");
    } finally {
      setLoading(false);
    }
  };

  /* ===== Cancel order ===== */
  const cancelOrder = async (orderId: string) => {
    const confirmed = window.confirm("ยืนยันยกเลิกออเดอร์นี้?");
    if (!confirmed) return;

    try {
      setCancellingId(orderId);
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "cancelled" } : o
        )
      );
      alert("ยกเลิกออเดอร์สำเร็จ");
      // หรือใช้ toast.success(...)
    } catch (err) {
      console.error("cancelOrder error:", err);
      alert("ไม่สามารถยกเลิกออเดอร์ได้ กรุณาลองใหม่ภายหลัง");
      // หรือใช้ toast.error(...)
    } finally {
      setCancellingId(null);
    }
  };

  /* ===== Init LIFF & Load Orders ===== */
  useEffect(() => {
    async function init() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_HISTORY_ORDERS;
        if (!liffId) {
          throw new Error("Missing LIFF ID");
        }
        await liff.init({ liffId });
        const uidStored = sessionStorage.getItem("user_id");
        let uid = uidStored;

        if (!uid && liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          const res = await fetch("/api/auth/line-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              line_id: profile.userId,
              name: profile.displayName,
              picture: profile.pictureUrl,
              get_user_id: true,
            }),
          });
          const data = await res.json();
          if (res.ok && data.user_id) {
            uid = data.user_id;
            if (uid) sessionStorage.setItem("user_id", uid);
          }
        }

        if (uid) {
          setUserId(uid);
          await loadOrders(uid);
        } else {
          setLoading(false);
          setError("ยังไม่ได้เข้าสู่ระบบ");
        }
      } catch (err) {
        console.error("LIFF init error:", err);
        setLoading(false);
        setError("ระบบขัด ข้อง กรุณาลองใหม่ภายหลัง");
      }
    }
    init();
  }, []);

  /* ===== Live update ===== */
  useEffect(() => {
    if (!userId) return;

    const channel = supa
      .channel(`orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const newOrder = payload.new as OrderItem;
          setOrders((prev) => {
            const exists = prev.find((o) => o.id === newOrder.id);
            if (exists) {
              return prev.map((o) => (o.id === newOrder.id ? newOrder : o));
            }
            return [newOrder, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">กำลังโหลด...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-5">
          <p className="text-red-500">{error}</p>
          {error === "ยังไม่ได้เข้าสู่ระบบ" ? (
            <button
              onClick={() => (window.location.href = "/")}
              className="mt-3 px-5 py-2 bg-blue-500 text-white rounded-xl"
            >
              กลับหน้าแรก
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-5 py-2 bg-blue-500 text-white rounded-xl"
            >
              ลองใหม่
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <header className="sticky top-0 bg-white/90 backdrop-blur px-5 pt-5 pb-3 flex justify-center items-center border-b border-slate-100 shadow-sm">
        <h1 className="text-base font-semibold text-blue-500 text-center">
          ประวัติออเดอร์
        </h1>
      </header>

      <main className="p-5 pb-20">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-sm font-medium">ยังไม่มีประวัติออเดอร์</h3>
            <p className="text-xs text-slate-500 mt-1">
              เริ่มสั่งซักเพื่อให้แสดงรายการที่นี่
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="mt-4 h-11 px-6 rounded-2xl bg-blue-500 text-white"
            >
              สั่งซักเลย
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const pill = statusBadge(o.status);
              const baskets = (o.addons?.baskets ?? []) as Basket[];
              const isOpen = !!openRows[o.id];

              const detailed = baskets.map((b, idx) => {
                const q = Number(b.qty ?? 1);
                const { wash, dry } = computeWashDry(b, basePrices);
                const soft = calculatePerSupply(b.size || "", Boolean(b.softener));
                const det = calculatePerSupply(b.size || "", Boolean(b.detergent));
                const supplies = soft + det;
                const shipShare = getDeliveryShare(o, idx, baskets.length);
                const subtotal = (wash + dry + supplies) * q + shipShare;
                return { q, wash, dry, supplies, shipShare, subtotal };
              });

              return (
                <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {o.order_number || `#${o.id.slice(0, 8)}`}
                      </div>
                      <div className="text-xs text-slate-500">{formatDate(o.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${pill.cls}`}>
                        {pill.text}
                      </span>
                      <button
                        onClick={() => toggleRow(o.id)}
                        className="h-8 w-8 grid place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-2 border border-slate-100">
                        {detailed.map((r, i) => (
                          <div key={i} className="border-b pb-2">
                            <div className="flex justify-between">
                              <span>ตะกร้า {i + 1}</span>
                              <span>{formatBaht(r.subtotal)}</span>
                            </div>
                            <div className="pl-3 text-xs text-slate-600">
                              <div>ค่าซัก: {formatBaht(r.wash)}</div>
                              <div>ค่าอบ: {formatBaht(r.dry)}</div>
                              <div>ค่าน้ำยา: {formatBaht(r.supplies)}</div>
                              <div>ค่าส่งเฉลี่ย: {formatBaht(r.shipShare)}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(o.status === "pending" || o.status === "accepted") && (
                        <button
                          onClick={() => cancelOrder(o.id)}
                          disabled={cancellingId === o.id}
                          className="w-full h-10 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:bg-rose-300 disabled:cursor-not-allowed hover:bg-rose-600 transition"
                        >
                          {cancellingId === o.id ? "กำลังยกเลิก..." : "ยกเลิกออเดอร์"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
