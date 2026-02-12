"use client"
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supa } from "@/app/lib/supabaseClient";
import {
  Clipboard, Check, X, Phone, MapPin, User, ArrowLeft,
  DollarSign, Package, RefreshCw, ChevronDown, Search,
  Clock, CheckCircle2, XCircle, AlertCircle, Share2, Eye, EyeOff,
  ArrowDownNarrowWide, ArrowUpNarrowWide, BarChart3, TrendingUp,
  ShoppingBag, Calendar, Ticket, Settings, Edit2, Truck, Bookmark
} from "lucide-react";
import Swal from "sweetalert2";

// ---- Theme (iOS look + MASAKDI blue) ----
const MASAKDI_BLUE = "#1257FF"; // ปรับเฉดตามสีโลโก้ได้
const BLUE_GRADIENT_FROM = "from-[#1257FF]";
const BLUE_GRADIENT_TO = "to-[#3A7BFF]";

// ---- Types ----
type OrderItem = {
  id: string;
  order_number?: string | null;
  created_at: string;
  status: "pending" | "accepted" | "washing" | "ready" | "delivering" | "completed" | "cancelled" | string;
  base_price?: number | null;
  supplies_total?: number | null;
  delivery_fee?: number | null;
  platform_fee?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  subtotal_before_discount?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  delivery?: { address?: string; mode?: string } | null;
  note?: string | null;
  slip_url?: string | null;
  addons?: any;
  order_type?: 'normal' | 'booking' | string | null;
  scheduled_date?: string | null;
  deleted_at?: string | null;
};

type ReportItem = {
  id: string;
  category: string;
  detail: string;
  contact_phone?: string | null;
  created_at: string;
  deleted_at?: string | null;
};

export default function AdminDispatchPage() {
  const router = useRouter();
  // Auth / tabs
  const [authOk, setAuthOk] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"dashboard" | "orders" | "reports" | "accounting" | "customers" | "services">("dashboard");

  // Costs configuration (standard average costs - can be estimated internal prices)
  const [costs, setCosts] = useState({
    basketS: 15,
    basketM: 20,
    basketL: 25,
    delivery: 10,
    platformCost: 5
  });

  // Persist costs
  useEffect(() => {
    const saved = localStorage.getItem("admin_costs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCosts(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse costs", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("admin_costs", JSON.stringify(costs));
  }, [costs]);

  // Data
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [basePrices, setBasePrices] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [platformFees, setPlatformFees] = useState<any[]>([]);
  const [deliveryFees, setDeliveryFees] = useState<any[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price">("newest");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Reports filters
  const [filterCat, setFilterCat] = useState("");

  // Date filters (for all tabs)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accountingPeriod, setAccountingPeriod] = useState<"today" | "week" | "month" | "custom">("today");

  const [showPass, setShowPass] = useState(false);

  // Restore session auth
  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (token) setAuthOk(true);
  }, []);

  // Admin login check
  const checkPass = async () => {
    const resp = await fetch("/api/admin/ping", {
      method: "GET",
      headers: { "x-admin-token": password },
    });
    if (resp.ok) {
      sessionStorage.setItem("admin_token", password);
      setAuthOk(true);
    } else {
      alert("รหัสผ่านไม่ถูกต้อง");
    }
  };

  // Load orders via API
  const loadOrders = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const token = sessionStorage.getItem("admin_token") || "";
      const resp = await fetch(`/api/admin/orders`, {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (!resp.ok) throw new Error("load orders failed");
      const json = await resp.json();
      setOrders(json.data || []);
    } catch (err) {
      console.error("Exception loading orders:", err);
      setOrders([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // Load reports directly (client)
  const loadReports = async () => {
    const { data, error } = await supa
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setReports(data);
  };

  // Initial load
  useEffect(() => {
    if (!authOk) return;
    loadOrders();
    loadReports();
    loadServiceConfigs();
  }, [authOk]);

  const loadServiceConfigs = async () => {
    const token = sessionStorage.getItem("admin_token") || "";
    try {
      const [res1, res2] = await Promise.all([
        fetch("/api/admin/prices", { headers: { "x-admin-token": token } }),
        fetch("/api/admin/delivery-fees", { headers: { "x-admin-token": token } })
      ]);
      if (res1.ok) {
        const { basePrices, supplies, platformFees } = await res1.json();
        setBasePrices(basePrices || []);
        setSupplies(supplies || []);
        setPlatformFees(platformFees || []);
      }
      if (res2.ok) {
        const { data } = await res2.json();
        setDeliveryFees(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePrice = async (type: "basePrice" | "supply" | "platformFee", item: any) => {
    const { value: price } = await Swal.fire({
      title: 'แก้ไขราคา',
      text: `ปรับราคาสำหรับ ${item.svc || item.category || item.fee_type || (item.key === 'detergent' ? 'ผงซักฟอก' : 'น้ำยาปรับผ้านุ่ม')} ${item.size ? `(ไซส์ ${item.size})` : ''}`,
      input: 'number',
      inputValue: item.price_ex_delivery || item.price || item.amount,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก'
    });

    if (price) {
      const token = sessionStorage.getItem("admin_token") || "";
      let updates: any = {};
      if (type === "basePrice") updates = { price_ex_delivery: Number(price) };
      else if (type === "supply") updates = { price: Number(price) };
      else if (type === "platformFee") updates = { amount: Number(price) };

      try {
        const res = await fetch("/api/admin/prices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ type, id: item.id, updates })
        });
        if (res.ok) {
          Swal.fire('สำเร็จ', 'อัปเดตข้อมูลแล้ว', 'success');
          loadServiceConfigs();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUpdateDelivery = async (item: any) => {
    const { value: formValues } = await Swal.fire({
      title: 'แก้ไขค่าส่ง',
      html:
        `<div class="space-y-4">
          <div><label class="text-xs font-bold block mb-1">Fee 1 (ใกล้)</label><input id="swal-fee1" class="swal2-input !m-0 !w-full" type="number" value="${item.fee_1}"></div>
          <div><label class="text-xs font-bold block mb-1">Fee 2 (ไกล)</label><input id="swal-fee2" class="swal2-input !m-0 !w-full" type="number" value="${item.fee_2}"></div>
          <div><label class="text-xs font-bold block mb-1">Extra per basket</label><input id="swal-extra" class="swal2-input !m-0 !w-full" type="number" value="${item.extra_per_basket}"></div>
        </div>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        return {
          fee_1: Number((document.getElementById('swal-fee1') as HTMLInputElement).value),
          fee_2: Number((document.getElementById('swal-fee2') as HTMLInputElement).value),
          extra_per_basket: Number((document.getElementById('swal-extra') as HTMLInputElement).value)
        }
      }
    });

    if (formValues) {
      const token = sessionStorage.getItem("admin_token") || "";
      try {
        const res = await fetch("/api/admin/delivery-fees", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ id: item.id, updates: formValues })
        });
        if (res.ok) {
          Swal.fire('สำเร็จ', 'อัปเดตค่าส่งแล้ว', 'success');
          loadServiceConfigs();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // ✅ Realtime subscription สำหรับ orders
  useEffect(() => {
    if (!authOk) return;

    console.log("🔔 [Admin] กำลังตั้งค่า Realtime subscription สำหรับ orders");

    const ordersChannel = supa
      .channel("admin-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          console.log("📬 [Admin] ได้รับการอัพเดท order:", payload);

          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as OrderItem;
            setOrders((prev) => [newOrder, ...prev]);

            // ✅ ส่ง Discord notification เมื่อมีออเดอร์ใหม่
            const total = (newOrder.base_price ?? 0) +
                          (newOrder.supplies_total ?? 0) +
                          (newOrder.delivery_fee ?? 0) +
                          (newOrder.platform_fee ?? 0) -
                          (newOrder.discount_amount ?? 0);

            try {
              await fetch("/api/discord/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "new_order",
                  data: { ...newOrder, total },
                }),
              });
              console.log("✅ Discord notification sent for new order");
            } catch (error) {
              console.error("❌ Failed to send Discord notification:", error);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedOrder = payload.new as OrderItem;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setOrders((prev) => prev.filter((o) => o.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log("🔔 [Admin] Orders subscription status:", status);
      });

    return () => {
      console.log("🔕 [Admin] ปิด orders subscription");
      supa.removeChannel(ordersChannel);
    };
  }, [authOk]);

  // ✅ Realtime subscription สำหรับ reports
  useEffect(() => {
    if (!authOk) return;

    console.log("🔔 [Admin] กำลังตั้งค่า Realtime subscription สำหรับ reports");

    const reportsChannel = supa
      .channel("admin-reports")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports",
        },
        async (payload) => {
          console.log("📬 [Admin] ได้รับการอัพเดท report:", payload);

          if (payload.eventType === "INSERT") {
            const newReport = payload.new as ReportItem;
            setReports((prev) => [newReport, ...prev]);

            // ✅ ส่ง Discord notification เมื่อมีรีพอร์ตใหม่
            try {
              await fetch("/api/discord/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "new_report",
                  data: newReport,
                }),
              });
              console.log("✅ Discord notification sent for new report");
            } catch (error) {
              console.error("❌ Failed to send Discord notification:", error);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedReport = payload.new as ReportItem;
            setReports((prev) =>
              prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setReports((prev) => prev.filter((r) => r.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        console.log("🔔 [Admin] Reports subscription status:", status);
      });

    return () => {
      console.log("🔕 [Admin] ปิด reports subscription");
      supa.removeChannel(reportsChannel);
    };
  }, [authOk]);

  // ✅ ฟังก์ชันส่ง Discord notification
  const sendDiscordNotification = async (type: string, data: any) => {
    try {
      await fetch("/api/discord/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      console.log("✅ Discord notification sent:", type);
    } catch (error) {
      console.error("❌ Failed to send Discord notification:", error);
      // ไม่ throw error เพราะไม่ต้องการให้การแจ้งเตือนล้มเหลวกระทบกับการทำงานหลัก
    }
  };

  // Update status via API
  const updateStatus = async (id: string, status: string) => {
    try {
      setUpdatingId(id);
      const token = sessionStorage.getItem("admin_token") || "";
      const resp = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ status }),
      });
      if (resp.status === 409) {
        alert("ออเดอร์นี้ถูกแอดมินคนอื่นรับไปแล้ว");
        await loadOrders();
        return;
      }
      if (!resp.ok) throw new Error("update failed");

      // ✅ ส่ง Discord notification เมื่ออัพเดทสถานะสำเร็จ
      const order = orders.find(o => o.id === id);
      if (order) {
        await sendDiscordNotification("status_update", {
          ...order,
          status,
          order_number: order.order_number || id,
        });
      }

      // optimistic update
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));
    } catch (e) {
      console.error(e);
      alert("อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setUpdatingId(null);
    }
  };


  // Share / Copy
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };


const shareOrder = async (order: OrderItem) => {
  const basePrice = order.base_price || 0;
  const suppliesTotal = order.supplies_total || 0;
  const deliveryFee = order.delivery_fee || 0;
  const platformFee = order.platform_fee || 0;
  const discountAmount = order.discount_amount || 0;
  const total = basePrice + suppliesTotal + deliveryFee + platformFee - discountAmount;

  // ── แปลงโหมดจัดส่ง ──
  const deliveryModeMap: Record<string, string> = {
    pickup_and_return: "🚚 รับ + ส่งคืน",
    pickup_only: "🚚 รับอย่างเดียว",
  };
const modeKey = order.delivery?.mode ?? "";
const deliveryMode = (deliveryModeMap[modeKey] ?? modeKey) || "-";


  // ── ข้อมูลจัดส่ง ──
  const deliveryInfo = order.delivery
    ? `📍 ที่อยู่จัดส่ง: ${order.delivery.address || "-"}\n🚗 โหมดจัดส่ง: ${deliveryMode}`
    : "📍 ที่อยู่จัดส่ง: -\n🚗 โหมดจัดส่ง: -";

  // ── บริการเสริม / รายละเอียดตะกร้า ──
  let basketsDetail = "-";
  let suppliesBreakdown = "";

  if (order.addons?.baskets && order.addons.baskets.length > 0) {
    const suppliesItems: string[] = [];

    basketsDetail = order.addons.baskets
      .map((basket: any, i: number) => {
        const size = basket.size || "-";
        let washPrice = 0;
        let dryPrice = 0;

        // คำนวณราคาตามประเภทบริการ
        if (basket.service === "wash_only") {
          washPrice = size === "S" ? 50 : size === "M" ? 50 : 50;
        } else if (basket.service === "dry_only") {
          dryPrice = size === "S" ? 60 : size === "M" ? 70 : 80;
        } else if (basket.service === "wash_and_dry") {
          washPrice = size === "S" ? 50 : size === "M" ? 60 : 70;
          dryPrice = size === "S" ? 50 : size === "M" ? 60 : 60;
        }

        // น้ำยาเสริม
        const pricePerItem = basket.size === "S" ? 10 : 15;
        const addonsArr: string[] = [];

        if (basket.softener) {
          addonsArr.push(`ปรับผ้านุ่ม (${pricePerItem} ฿)`);
          suppliesItems.push(`• ปรับผ้านุ่ม: ${pricePerItem} ฿`);
        }
        if (basket.detergent) {
          addonsArr.push(`ผงซักฟอก (${pricePerItem} ฿)`);
          suppliesItems.push(`• ผงซักฟอก: ${pricePerItem} ฿`);
        }

        const addons = addonsArr.length > 0 ? addonsArr.join(", ") : "ไม่มี";

        let serviceText = "";
        if (basket.service === "wash_only") {
          serviceText = `ซัก ${washPrice} ฿`;
        } else if (basket.service === "dry_only") {
          serviceText = `อบ ${dryPrice} ฿`;
        } else if (basket.service === "wash_and_dry") {
          serviceText = `ซัก ${washPrice} ฿ + อบ ${dryPrice} ฿`;
        }

        return `ตะกร้าที่ ${i + 1}:
  • ไซส์: ${size}
  • บริการ: ${serviceText}
  • น้ำยาเพิ่มเติม: ${addons}`;
      })
      .join("\n\n");

    if (suppliesItems.length > 0) {
      const uniqueSupplies = Array.from(new Set(suppliesItems));
      suppliesBreakdown = "\n" + uniqueSupplies.join("\n");
    }
  }

  const basketPhotoUrl = order.addons?.basket_photo_url || "-";

  // ── รวมข้อมูลทั้งหมด ──
  const text = `
🧺 ออเดอร์ใหม่
Order: ${order.order_number || order.id}
สถานะ: ${order.status || "-"}
ชื่อ: ${order.contact_name || "-"}
เบอร์: ${order.contact_phone || "-"}
${deliveryInfo}

📦 รายละเอียดตะกร้า:
${basketsDetail}

🧴 รายละเอียดน้ำยา:
${suppliesBreakdown || "-"}

ค่า Size: ${basePrice.toLocaleString("th-TH")} ฿
ค่าน้ำยา: ${suppliesTotal.toLocaleString("th-TH")} ฿
ค่าจัดส่ง: ${deliveryFee.toLocaleString("th-TH")} ฿
ค่าบริการ: ${platformFee.toLocaleString("th-TH")} ฿
${discountAmount > 0 ? `ส่วนลด: -${discountAmount.toLocaleString("th-TH")} ฿\n` : ""}💰 ยอดรวมทั้งหมด: ${total.toLocaleString("th-TH")} ฿

หมายเหตุ: ${order.note || "-"}
📄 ลิงก์สลิป: ${order.slip_url || "-"}
🖼️ รูปตะกร้า: ${basketPhotoUrl}
`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "แชร์ออเดอร์", text });
    } else {
      await navigator.clipboard.writeText(text);
      alert("คัดลอกข้อมูลแล้ว (อุปกรณ์นี้ไม่รองรับการแชร์)");
    }
  } catch (err) {
    console.error("แชร์ไม่สำเร็จ:", err);
  }
};




  // ✅ Filters by date range
  const filterByDateRange = (items: (OrderItem | ReportItem)[]) => {
    if (!startDate && !endDate) return items;

    return items.filter(item => {
      const itemDate = new Date(item.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        return itemDate >= start && itemDate <= new Date(end.getTime() + 86400000); // +1 day
      } else if (start) {
        return itemDate >= start;
      } else if (end) {
        return itemDate <= new Date(end.getTime() + 86400000);
      }
      return true;
    });
  };

  // Filters & sorting
  const filteredOrders = orders
    .filter(o => {
      // ✅ ซ่อนรายการที่ลบแล้ว
      if (o.deleted_at) return false;

      const matchStatus = statusFilter === "all" 
        ? true 
        : statusFilter === "today"
          ? (new Date(o.created_at).toDateString() === new Date().toDateString() || (o.scheduled_date && new Date(o.scheduled_date).toDateString() === new Date().toDateString()))
          : statusFilter === "booking"
            ? o.order_type === "booking"
            : statusFilter === "pending"
              ? (o.status !== "completed" && o.status !== "cancelled")
              : statusFilter === "accepted"
                ? ["accepted", "washing", "ready", "delivering"].includes(o.status || "")
                : o.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.contact_name?.toLowerCase().includes(q) ||
        o.contact_phone?.includes(searchQuery.trim()) ||
        o.delivery?.address?.toLowerCase().includes(q);

      // ✅ Apply date filter
      const itemDate = new Date(o.created_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      let matchDate = true;

      if (start && end) {
        matchDate = itemDate >= start && itemDate <= new Date(end.getTime() + 86400000);
      } else if (start) {
        matchDate = itemDate >= start;
      } else if (end) {
        matchDate = itemDate <= new Date(end.getTime() + 86400000);
      }

      return matchStatus && matchSearch && matchDate;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const aTotal = (a.base_price ?? 0) + (a.supplies_total ?? 0) + (a.delivery_fee ?? 0) + (a.platform_fee ?? 0) - (a.discount_amount ?? 0);
      const bTotal = (b.base_price ?? 0) + (b.supplies_total ?? 0) + (b.delivery_fee ?? 0) + (b.platform_fee ?? 0) - (b.discount_amount ?? 0);
      return bTotal - aTotal;
    });

  // ✅ Detailed Statistics Breakdown
  const getAccountingStats = (ordersList: OrderItem[]) => {
    let wash = 0;
    let dry = 0;
    let delivery = 0;
    let platform = 0;
    let supplies = 0;
    let discount = 0;
    let cost = 0;

    ordersList.forEach(o => {
      if (o.status === "cancelled" || o.deleted_at) return;
      
      delivery += o.delivery_fee ?? 0;
      platform += o.platform_fee ?? 0;
      supplies += o.supplies_total ?? 0;
      discount += o.discount_amount ?? 0;

      if (o.addons?.baskets && o.addons.baskets.length > 0) {
        o.addons.baskets.forEach((b: any) => {
          const sz = b.size || "S";
          const serviceType = (b.service === "wash_dry" || b.service === "wash_and_dry") ? "wash_and_dry" : 
                             (b.service === "wash_only" ? "wash_only" : 
                             (b.service === "dry_only" ? "dry_only" : "wash_and_dry"));

          // พยายามหาค่าจาก basePrices ที่โหลดมาจาก DB
          const match = basePrices.find(p => p.size === sz && p.svc === serviceType);
          
          let w = 0;
          let d = 0;

          if (match && match.breakdown) {
            // รองรับทั้ง key 'wash' และ 'wash_only' / 'dry' และ 'dry_only'
            w = match.breakdown.wash || match.breakdown.wash_only || 0;
            d = match.breakdown.dry || match.breakdown.dry_only || 0;
          } else {
            // fallback (ถ้ายังไม่โหลดหรือหาไม่เจอ)
            if (serviceType === "wash_only") w = 50;
            else if (serviceType === "dry_only") d = sz === "S" ? 60 : sz === "M" ? 70 : 80;
            else if (serviceType === "wash_and_dry") {
              w = sz === "S" ? 50 : sz === "M" ? 60 : 70;
              d = sz === "S" ? 50 : sz === "M" ? 60 : 60;
            }
          }
          
          wash += w;
          dry += d;

          // Cost estimation (คงเดิมสำหรับต้นทุนภายใน)
          if (sz === "S") cost += costs.basketS;
          else if (sz === "M") cost += costs.basketM;
          else if (sz === "L") cost += costs.basketL;
          else cost += costs.basketS;
        });
      } else {
        wash += o.base_price ?? 0;
      }
      
      cost += (o.delivery_fee ? (costs as any).delivery : 0) + (costs as any).platformCost;
    });

    const revenue = wash + dry + delivery + platform + supplies - discount;
    const profit = revenue - cost;

    return { wash, dry, delivery, platform, supplies, discount, revenue, cost, profit };
  };

  const dashboardStats = {
    totalOrders: filteredOrders.length,
    totalRevenue: filteredOrders
      .filter(o => o.status !== "cancelled")
      .reduce((sum, o) =>
        sum + (o.base_price ?? 0) + (o.supplies_total ?? 0) + (o.delivery_fee ?? 0) + (o.platform_fee ?? 0) - (o.discount_amount ?? 0), 0
      ),
    pendingOrders: filteredOrders.filter(o => o.status === "pending").length,
    completedOrders: filteredOrders.filter(o => o.status === "completed").length,
    cancelledOrders: filteredOrders.filter(o => o.status === "cancelled").length,
    inProgressOrders: filteredOrders.filter(o =>
      ["accepted", "washing", "ready", "delivering"].includes(o.status)
    ).length,
    avgOrderValue: filteredOrders.length > 0
      ? filteredOrders.reduce((sum, o) =>
          sum + (o.base_price ?? 0) + (o.supplies_total ?? 0) + (o.delivery_fee ?? 0) + (o.platform_fee ?? 0) - (o.discount_amount ?? 0), 0
        ) / filteredOrders.length
      : 0,
    todayOrders: orders.filter(o => {
      const today = new Date();
      const orderDate = new Date(o.created_at);
      return orderDate.toDateString() === today.toDateString();
    }).length,
  };

  // Helper to filter by period for accounting
  const getOrdersInPeriod = (p: string) => {
    const now = new Date();
    return orders.filter(o => {
      if (o.status === "cancelled" || o.deleted_at) return false;
      const d = new Date(o.created_at);
      if (p === "today") return d.toDateString() === now.toDateString();
      if (p === "week") {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0,0,0,0);
        return d >= start;
      }
      if (p === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true; // custom uses filteredOrders global state
    });
  };

  const accountingOrders = accountingPeriod === "today" ? getOrdersInPeriod("today") :
                           accountingPeriod === "week" ? getOrdersInPeriod("week") :
                           accountingPeriod === "month" ? getOrdersInPeriod("month") :
                           filteredOrders;

  const currentAccounting = getAccountingStats(accountingOrders);

  const filteredReports = reports.filter((r) => {
    // ✅ ซ่อนรายการที่ลบแล้ว
    if (r.deleted_at) return false;

    const matchCat = !filterCat || r.category === filterCat;
    const t = new Date(r.created_at).getTime();
    const after = !startDate || t >= new Date(startDate).getTime();
    const before = !endDate || t <= new Date(endDate).getTime() + 86400000;
    return matchCat && after && before;
  });


  // Stats
  const stats = {
    pending: orders.filter(o => o.status === "pending").length,
    accepted: orders.filter(o => o.status === "accepted").length,
    completed: orders.filter(o => o.status === "completed").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
    total: orders.reduce((sum, o) => sum + (o.base_price ?? 0) + (o.supplies_total ?? 0) + (o.delivery_fee ?? 0) + (o.platform_fee ?? 0) - (o.discount_amount ?? 0), 0)
  };

  const [isOpen, setIsOpen] = useState(false);

  const sortOptions = [
    { value: "newest", label: "ใหม่สุด", icon: <ArrowDownNarrowWide className="w-4 h-4" /> },
    { value: "oldest", label: "เก่าสุด", icon: <ArrowUpNarrowWide className="w-4 h-4" /> },
    { value: "price", label: "ราคาสูงสุด", icon: <DollarSign className="w-4 h-4" /> },
  ] as const;

  const currentOption = sortOptions.find(o => o.value === sortBy);


  if (!authOk)
    return (
      <div className="min-h-screen bg-white">
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-96 text-center border border-slate-200">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${MASAKDI_BLUE}15` }}>
              <Package className="w-8 h-8" style={{ color: MASAKDI_BLUE }} />
            </div>
            <h1 className="text-xl font-semibold mb-2 text-slate-900">MASAKDI Admin</h1>
            <p className="text-sm text-slate-500 mb-6">ระบบจัดการออเดอร์และรีพอร์ต</p>
            <div className="relative mb-4">
              <input
                type={showPass ? "text" : "password"}
                placeholder="รหัสผ่านผู้ดูแล"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:ring-2 outline-none"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkPass()}
                autoComplete="current-password"
                inputMode="text"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100"
                aria-label={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                title={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPass ? <EyeOff className="w-5 h-5 text-slate-500" /> : <Eye className="w-5 h-5 text-slate-500" />}
              </button>
            </div>
            <button
              onClick={checkPass}
              className={`w-full py-3 text-white rounded-2xl font-medium active:scale-[0.98] transition shadow-lg bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO}`}
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-white pb-24 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">MASAKDI</h1>
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Admin Panel</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push("/Admins/Membership")}
              className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition active:scale-90"
            >
              <User size={18} />
            </button>
            <button
              onClick={() => router.push("/Admins/BookingConfig")}
              className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition active:scale-90"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs (Replaces Bottom Nav) */}
        <div className="flex bg-white px-2 border-t border-slate-50 overflow-x-auto no-scrollbar">
          {[
            { key: "dashboard", label: "รวม", icon: BarChart3 },
            { key: "orders", label: "งาน", icon: ShoppingBag },
            { key: "accounting", label: "เงิน", icon: DollarSign },
            { key: "customers", label: "ลูกค้า", icon: User },
            { key: "services", label: "บริการ", icon: Settings },
            { key: "reports", label: "แจ้ง", icon: AlertCircle }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex-1 min-w-[70px] py-3 flex flex-col items-center gap-1 transition-all relative ${
                tab === key ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-bold">{label}</span>
              {tab === key && (
                <div className="absolute bottom-0 left-2 right-2 h-1 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>



      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <div className="px-5 py-8 space-y-8 pb-32 bg-slate-50/30">
          {/* Main Stat Card */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-150 rotate-12">
               <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3 block">รายรับรวม (Selected Period)</span>
              <p className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">
                {dashboardStats.totalRevenue.toLocaleString()}
                <span className="text-2xl font-medium text-slate-300 ml-2">฿</span>
              </p>
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1">
                  <Package size={12} /> {dashboardStats.totalOrders} ORDERS
                </div>
                <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1">
                   AVG: {dashboardStats.avgOrderValue.toFixed(0)} ฿
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Pending", count: dashboardStats.pendingOrders, icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
              { label: "Active", count: dashboardStats.inProgressOrders, icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-50" },
              { label: "Completed", count: dashboardStats.completedOrders, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
              { label: "Today", count: dashboardStats.todayOrders, icon: Calendar, color: "text-slate-900", bg: "bg-slate-100" },
            ].map((s) => (
              <div key={s.label} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-3">
                <div className={`${s.bg} ${s.color} w-10 h-10 rounded-2xl flex items-center justify-center`}>
                  <s.icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                  <p className="text-2xl font-black text-slate-900">{s.count}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Date Filter Compact */}
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-60">ตัวกรองช่วงเวลา</h3>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:text-slate-900 outline-none transition-all"
              />
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:bg-white focus:text-slate-900 outline-none transition-all"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => {setStartDate(""); setEndDate("");}}
                className="w-full py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}


      {/* Orders Tab */}
      {tab === "orders" && (
        <>
          {/* Orders Header Section */}
          <div className="sticky top-[-1px] z-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 pb-4">
            <div className="px-5 pt-5 space-y-4">
              {/* Better Search Bar */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขออเดอร์, ชื่อ, เบอร์โทร..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-50 text-sm font-medium outline-none focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Status Chips */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {[
                  { value: "all", label: "ทั้งหมด", icon: Package, color: "bg-slate-900" },
                  { value: "today", label: "งานวันนี้", icon: Calendar, color: "bg-rose-500" },
                  { value: "booking", label: "งานจอง", icon: Bookmark, color: "bg-purple-500" },
                  { value: "pending", label: "รอดำเนินการ", icon: Clock, color: "bg-amber-500" },
                  { value: "accepted", label: "กำลังทำ", icon: RefreshCw, color: "bg-blue-500" },
                  { value: "completed", label: "สำเร็จ", icon: CheckCircle2, color: "bg-emerald-600" },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                      statusFilter === s.value 
                      ? `${s.color} text-white shadow-lg ring-2 ring-offset-2 ring-slate-100` 
                      : "bg-white text-slate-500 border border-slate-100"
                    }`}
                  >
                    <s.icon size={14} className={statusFilter === s.value ? "animate-pulse" : ""} />
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">
                <div className="flex gap-4">
                  <span>Results: {filteredOrders.length}</span>
                </div>
                <button 
                  onClick={() => {
                    setStartDate(""); 
                    setEndDate(""); 
                    setSearchQuery(""); 
                    setStatusFilter("all");
                  }} 
                  className="text-blue-600 font-bold active:scale-95 transition-all"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Orders List */}
          <main className="px-4 pt-4 space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {searchQuery ? "ไม่พบออเดอร์ที่ค้นหา" : "ไม่มีออเดอร์"}
                </p>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const total = (o.base_price ?? 0) + (o.supplies_total ?? 0) + (o.delivery_fee ?? 0);
                const date = new Date(o.created_at);
                const isExpanded = expandedOrder === o.id;
                const timeAgo = getTimeAgo(date);

                return (
                  <div
                    key={o.id}
                    className={`bg-white rounded-3xl shadow-sm border transition-all ${o.status === "pending"
                      ? "border-yellow-200"
                      : "border-slate-200"
                      }`}
                  >
                    {/* Header */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 text-base">
                              {o.order_number || `#${o.id.slice(0, 8)}`}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${o.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : o.status === "cancelled"
                                  ? "bg-rose-100 text-rose-800"
                                  : o.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "text-white bg-[rgba(18,87,255,0.85)]"
                                }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{timeAgo}</div>
                        </div>
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                          className="p-1.5 rounded-xl hover:bg-slate-100 transition"
                        >
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Quick Info */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {o.contact_name || "ไม่ระบุชื่อ"}
                            </div>
                            {o.contact_phone && (
                              <a
                                href={`tel:${o.contact_phone}`}
                                className="text-xs underline"
                                style={{ color: MASAKDI_BLUE }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {o.contact_phone}
                              </a>
                            )}
                          </div>
                        </div>

                        {!isExpanded && o.delivery?.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-slate-700 line-clamp-1">
                              {o.delivery.address}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="text-lg font-bold text-slate-900">
                            {total.toLocaleString("th-TH")} ฿
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                          {o.delivery?.address && (
                            <div className="rounded-2xl p-3 border border-slate-200 bg-white">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <div className="text-[10px] text-slate-500 font-medium mb-1">ที่อยู่จัดส่ง</div>
                                  <div className="text-xs text-slate-800">{o.delivery.address}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {o.note && (
                            <div className="rounded-2xl p-3 border border-amber-200 bg-amber-50">
                              <div className="text-[10px] text-amber-700 font-medium mb-1">หมายเหตุ</div>
                              <div className="text-xs text-amber-900">{o.note}</div>
                            </div>
                          )}

                          <div className="rounded-2xl p-3 grid grid-cols-3 gap-2 text-center border border-slate-200">
                            <div>
                              <div className="text-[10px] text-slate-500">ราคาSize</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {(o.base_price ?? 0).toLocaleString()}฿
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500">ค่าน้ำยา</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {(o.supplies_total ?? 0).toLocaleString()}฿
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500">ค่าส่ง</div>
                              <div className="text-sm font-semibold text-slate-900">
                                {(o.delivery_fee ?? 0).toLocaleString()}฿
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => copyToClipboard(o.id)}
                              className="w-full py-2 rounded-2xl bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition"
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              คัดลอก Order ID
                            </button>

                            <button
                              onClick={() => shareOrder(o)}
                              className={`w-full py-2 rounded-2xl text-white text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition shadow-md bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO}`}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              แชร์ออเดอร์
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        {o.status === "pending" && (
                          <button
                            disabled={updatingId === o.id}
                            onClick={() => updateStatus(o.id, "accepted")}
                            className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition shadow-md bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO}`}
                          >
                            <Check className="w-4 h-4" /> รับงาน
                          </button>
                        )}
                        {o.status === "accepted" && (
                          <button
                            disabled={updatingId === o.id}
                            onClick={() => updateStatus(o.id, "completed")}
                            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" /> เสร็จสิ้น
                          </button>
                        )}
                        {o.status !== "cancelled" && o.status !== "completed" && (
                          <button
                            disabled={updatingId === o.id}
                            onClick={() => updateStatus(o.id, "cancelled")}
                            className="flex-1 py-2.5 rounded-2xl bg-rose-50 text-rose-700 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition border border-rose-200"
                          >
                            <X className="w-4 h-4" /> ยกเลิก
                          </button>
                        )}
                        {o.contact_phone && (
                          <a
                            href={`tel:${o.contact_phone}`}
                            className="px-4 py-2.5 rounded-2xl bg-green-50 text-green-700 text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition border border-green-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </>
      )}

      {/* Reports Tab */}
      {tab === "reports" && (
        <div className="bg-slate-50/30 min-h-screen pb-32">
          {/* Enhanced Filter Section */}
          <div className="sticky top-[104px] z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-4">
            <div className="max-w-xl mx-auto space-y-3">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <AlertCircle size={18} />
                </div>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border-2 border-slate-50 text-sm font-bold text-slate-800 outline-none focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none shadow-sm"
                >
                  <option value="">📋 ทั้งหมด (All Reports)</option>
                  <option value="delivery">🚚 การจัดส่ง (Delivery)</option>
                  <option value="payment">💰 การชำระเงิน (Payment)</option>
                  <option value="quality">⭐ คุณภาพ (Quality)</option>
                  <option value="system">⚙️ ระบบ (System)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-4 top-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-4 pr-3 pt-6 pb-2 rounded-2xl bg-white border-2 border-slate-50 text-xs font-bold text-slate-900 outline-none focus:border-blue-500/20 transition-all shadow-sm"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-4 pr-3 pt-6 pb-2 rounded-2xl bg-white border-2 border-slate-50 text-xs font-bold text-slate-900 outline-none focus:border-blue-500/20 transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <main className="px-5 pt-6 max-w-xl mx-auto space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Latest Reports ({filteredReports.length})</h2>
              {(filterCat || startDate || endDate) && (
                <button onClick={() => {setFilterCat(""); setStartDate(""); setEndDate("");}} className="text-[10px] font-black text-blue-600 uppercase tracking-wider underline">Clear</button>
              )}
            </div>

            {filteredReports.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <AlertCircle className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-400">ไม่พบบันทึกการแจ้งปัญหา</p>
              </div>
            ) : (
              filteredReports.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/40 border border-slate-50 space-y-4 group active:scale-[0.98] transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 ${
                      r.category === 'payment' ? 'bg-amber-50 text-amber-600' :
                      r.category === 'delivery' ? 'bg-blue-50 text-blue-600' :
                      r.category === 'quality' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="text-base">{getCategoryEmoji(r.category)}</span>
                      {r.category}
                    </div>
                    <div className="text-[10px] font-bold text-slate-300">
                      {getTimeAgo(new Date(r.created_at))}
                    </div>
                  </div>

                  <div className="text-base font-medium text-slate-800 leading-relaxed pl-1">
                    {r.detail}
                  </div>

                  {r.contact_phone && (
                    <div className="pt-2 flex items-center gap-3">
                      <a
                        href={`tel:${r.contact_phone}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-50 text-emerald-600 text-xs font-black shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-100 transition-colors"
                      >
                        <Phone size={14} className="animate-pulse" /> {r.contact_phone}
                      </a>
                      <button 
                        onClick={() => copyToClipboard(r.contact_phone)}
                        className="p-3.5 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Clipboard size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </main>
        </div>
      )}

      {/* Accounting Tab */}
      {tab === "accounting" && (
        <div className="px-4 py-8 space-y-8 bg-slate-50/50 min-h-screen">
          {/* Period Toggles */}
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 mb-6">
            {(["today", "week", "month", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAccountingPeriod(p)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  accountingPeriod === p 
                  ? "bg-slate-900 text-white shadow-md scale-[1.02]" 
                  : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p === "today" ? "วันนี้" : p === "week" ? "สัปดาห์นี้" : p === "month" ? "เดือนนี้" : "กำหนดเอง"}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-br from-indigo-700 via-blue-700 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden ring-4 ring-white">
            <div className="absolute top-0 right-0 p-6 opacity-10 blur-sm">
              <BarChart3 size={120} />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-indigo-100 text-xs font-black uppercase tracking-[0.2em] mb-2">รายได้รวมทั้งหมด</h2>
                  <p className="text-5xl font-black flex items-end gap-2">
                    {currentAccounting.revenue.toLocaleString()} 
                    <span className="text-2xl font-medium opacity-60 pb-1">฿</span>
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                   <DollarSign className="text-emerald-300" size={24} />
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/5">
                <div>
                  <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-1">เป้าหมายรายได้ (Revenue Goal)</p>
                  <p className="text-2xl font-black text-emerald-300 flex items-center gap-1">
                    100%
                    <span className="text-xs font-medium opacity-60">ACHIEVED</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-xl space-y-6">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              รายละเอียดแยกตามบริการ
            </h3>
            
            <div className="space-y-4">
              {[
                { label: "ค่าซักผ้า", value: currentAccounting.wash, color: "bg-blue-500", icon: "🧺" },
                { label: "ค่าอบผ้า", value: currentAccounting.dry, color: "bg-orange-500", icon: "🔥" },
                { label: "ค่าส่งผ้า", value: currentAccounting.delivery, color: "bg-emerald-500", icon: "🚚" },
                { label: "ค่าน้ำยา", value: currentAccounting.supplies, color: "bg-purple-500", icon: "🧴" },
                { label: "ค่าบริการระบบ", value: currentAccounting.platform, color: "bg-slate-500", icon: "⚙️" },
                { label: "ส่วนลดลูกค้า", value: -currentAccounting.discount, color: "bg-rose-500", icon: "🎟️" },
              ].map((item) => (
                <div key={item.label} className="group cursor-default">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm font-bold text-slate-600">{item.label}</span>
                    </div>
                    <span className={`text-sm font-black ${item.value < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {item.value.toLocaleString()} ฿
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out shadow-sm`}
                      style={{ width: `${currentAccounting.revenue > 0 ? (Math.abs(item.value) / currentAccounting.revenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Services Tab */}
      {tab === "services" && (
        <div className="px-5 py-8 space-y-8 pb-32 bg-slate-50/30 min-h-screen">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">ตั้งค่าบริการ</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pricing & Service Configuration</p>
          </div>

          {/* Base Prices */}
          <section className="space-y-4">
             <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
                        <Package size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">ราคาซักรีด</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Service Pricing (By Size)</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {['S', 'M', 'L'].map(sz => {
                    const items = basePrices.filter(p => p.size === sz && p.svc !== 'wash_and_dry' && p.svc !== 'wash_dry');
                    if (items.length === 0) return null;
                    return (
                        <div key={sz} className="bg-white rounded-[2.5rem] p-2 shadow-xl border border-slate-100 relative overflow-hidden group">
                           {/* Size Badge */}
                           <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                              <span className="text-2xl font-black text-slate-900 tracking-tighter">Size {sz}</span>
                              <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[10px] font-black text-blue-400 border border-blue-100/50">
                                 {sz}
                              </div>
                           </div>
                           
                           <div className="p-3 space-y-2.5">
                              {items.sort((a,b) => a.svc.localeCompare(b.svc)).map(p => (
                                 <div key={p.id} className="bg-slate-50/50 rounded-[1.8rem] p-4 flex items-center justify-between hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-blue-100 group/item">
                                    <div>
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">
                                          {p.svc === 'wash_only' ? 'ซักอย่างเดียว' : p.svc === 'dry_only' ? 'อบอย่างเดียว' : p.svc}
                                       </p>
                                       <p className="text-xl font-black text-slate-900">{p.price_ex_delivery} <span className="text-sm font-medium opacity-30">฿</span></p>
                                    </div>
                                    <button 
                                      onClick={() => handleUpdatePrice("basePrice", p)}
                                      className="w-10 h-10 bg-white shadow-sm border border-slate-100 text-slate-300 rounded-xl flex items-center justify-center group-hover/item:bg-blue-600 group-hover/item:text-white group-hover/item:border-blue-600 transition-all active:scale-90"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        </div>
                    )
                })}
             </div>
          </section>

          {/* Platform Fees */}
          <section className="space-y-4">
             <div className="flex items-center justify-between mb-4 px-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shadow-sm border border-rose-50">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">ค่าบริการระบบ</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platform Service Fees</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platformFees.map(pf => (
                   <div key={pf.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 hover:border-rose-100 transition-all flex items-center justify-between group">
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{pf.fee_name || pf.fee_type}</p>
                         <p className="text-2xl font-black text-slate-900">{pf.amount} <span className="text-sm font-medium opacity-30">฿</span></p>
                      </div>
                      <button 
                        onClick={() => handleUpdatePrice("platformFee", pf)}
                        className="w-12 h-12 bg-slate-50 text-slate-300 rounded-[1.2rem] flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all active:scale-90"
                      >
                        <Edit2 size={18} />
                      </button>
                   </div>
                ))}
             </div>
          </section>

          {/* Supplies */}
          <section className="space-y-4">
             <div className="flex items-center justify-between mb-4 px-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-50">
                        <ShoppingBag size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">ค่าน้ำยาเพิ่มเติม</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detergent & Softener</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['S', 'M', 'L'].map(sz => {
                    const items = supplies.filter(s => s.size === sz);
                    if (items.length === 0) return null;
                    return (
                        <div key={sz} className="bg-white rounded-[2.5rem] p-2 shadow-xl border border-slate-100 relative overflow-hidden">
                           <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-purple-50/30">
                              <span className="text-xl font-black text-slate-900">ไซส์ {sz}</span>
                           </div>
                           <div className="p-4 space-y-3">
                              {items.map(s => (
                                 <div key={s.id} className="bg-slate-50/50 rounded-[1.5rem] p-4 flex items-center justify-between hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-purple-100 group/item">
                                    <div>
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.key === 'detergent' ? 'ผงซักฟอก' : 'น้ำยาปรับผ้านุ่ม'}</p>
                                       <p className="text-xl font-black text-slate-900">{s.price} <span className="text-sm font-medium opacity-30">฿</span></p>
                                    </div>
                                    <button 
                                      onClick={() => handleUpdatePrice("supply", s)}
                                      className="w-10 h-10 bg-white shadow-sm border border-slate-100 text-slate-300 rounded-xl flex items-center justify-center group-hover/item:bg-purple-600 group-hover/item:text-white group-hover/item:border-purple-600 transition-all active:scale-90"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        </div>
                    )
                })}
             </div>
          </section>

          {/* Delivery Fees */}
          <section className="space-y-4">
             <div className="flex items-center justify-between mb-4 px-1 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">ค่าขนส่ง</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Logistics Pricing</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deliveryFees.map((df) => (
                  <div key={df.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 hover:shadow-2xl transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex gap-3">
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                             <Truck size={24} />
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">SERVICE MODE</p>
                             <h4 className="text-lg font-black text-slate-800 tracking-tight">
                               {df.mode === 'pickup_only' ? 'รับผ้าอย่างเดียว' : 
                                df.mode === 'pickup_and_return' ? 'รับและส่งคืน' : 
                                df.mode === 'dropoff_only' ? 'ส่งคืนอย่างเดียว' : df.mode}
                             </h4>
                          </div>
                       </div>
                       <button 
                         onClick={() => handleUpdateDelivery(df)}
                         className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-200 transition-all active:scale-90"
                       >
                         <Edit2 size={16} />
                       </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                       <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">ใกล้</p>
                          <p className="text-xl font-black text-slate-900">{df.fee_1}<span className="text-[10px] font-medium opacity-30 ml-0.5">฿</span></p>
                       </div>
                       <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">ไกล</p>
                          <p className="text-xl font-black text-slate-900">{df.fee_2}<span className="text-[10px] font-medium opacity-30 ml-0.5">฿</span></p>
                       </div>
                       <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">เพิ่ม/ใบ</p>
                          <p className="text-xl font-black text-emerald-600">+{df.extra_per_basket}<span className="text-[10px] font-medium opacity-30 ml-0.5">฿</span></p>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </section>
        </div>
      )}

      {/* Customers Tab */}
      {tab === "customers" && (
        <div className="px-4 py-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-900">ฐานลูกค้า</h2>
            <div className="text-xs text-slate-500">
               ทั้งหมด {Array.from(new Set(orders.map(o => o.contact_phone))).length} ราย
            </div>
          </div>
          
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ เบอร์โทรลูกค้า..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {Array.from(new Map(orders
              .filter(o => o.contact_phone && 
                (o.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 o.contact_phone.includes(searchQuery)))
              .map(o => [o.contact_phone, o])).values())
              .map((c) => {
                const userOrders = orders.filter(x => x.contact_phone === c.contact_phone);
                const sizes = Array.from(new Set(userOrders.flatMap(x => x.addons?.baskets?.map((b: any) => b.size) || [])));
                
                return (
                  <div key={c.contact_phone} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <User size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{c.contact_name || "ไม่ระบุชื่อ"}</h3>
                          <p className="text-xs text-slate-500 font-medium">{c.contact_phone}</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 uppercase">
                        {userOrders.length} ออเดอร์
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-slate-400 mt-0.5" />
                        <p className="text-xs text-slate-600 line-clamp-1">{c.delivery?.address || "ไม่มีข้อมูลที่อยู่"}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-slate-400" />
                        <div className="flex gap-1.5">
                          {sizes.length > 0 ? sizes.map(sz => (
                            <span key={sz as string} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100">
                              Size {sz as string}
                            </span>
                          )) : <span className="text-[10px] text-slate-400">-</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          setSearchQuery(c.contact_phone || "");
                          setTab("orders");
                        }}
                        className="w-full py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold active:scale-95 transition-all shadow-md"
                      >
                        ดูประวัติการสั่งซื้อ
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "เพิ่งเปิด";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    delivery: "🚚",
    payment: "💰",
    quality: "⭐",
    system: "⚙️"
  };
  return emojiMap[category] || "📋";
}
