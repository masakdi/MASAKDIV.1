"use client";
import liff from "@line/liff";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  supa,
  BUCKET_SLIPS,
  BUCKET_BASKETS,
  QR_URL,
} from "./lib/supabaseClient";
import BottomNav from "./components/BottomNav";
import Swal from "sweetalert2";
import {
  getUserCoupons,
  calculateDiscount,
  markCouponUsed,
  getUserTier,
  type Coupon,
} from "@/app/actions/coupon";
import {
  Ticket,
  Receipt,
  Truck,
  Image as ImageIcon,
  CheckCircle,
  Edit2,
  Loader2,
  ArrowLeft,
  MoveLeft,
  Crown,
  MapPin,
  X,
  Gift,
  CalendarClock,
} from "lucide-react";

/* ===== Types ===== */
type SizeKey = "S" | "M" | "L";
type ServiceType = "wash_only" | "dry_only" | "wash_and_dry";
type DeliveryMode = "pickup_only" | "pickup_and_return";

type BasePriceRow = {
  size: SizeKey;
  svc: ServiceType;
  price_ex_delivery: number;
  breakdown?: any;
};
type DeliveryFeeRow = {
  mode: DeliveryMode;
  fee_1: number;
  fee_2: number;
  extra_per_basket: number;
};
type SupplyRow = { key: string; size: string; price: number };

type Basket = {
  id: number;
  size: SizeKey | "";
  service: ServiceType | "";
  softener: boolean;
  detergent: boolean;
  qty?: number;
};

/* ===== Constants ===== */
const BAD_WORDS = [/ควย/i, /เหี้ย/i, /สัส/i, /fuck/i, /shit/i];
const MAX_IMG = 5 * 1024 * 1024;

/* ===== Helper Functions ===== */
const cleanNote = (s: string) => {
  let t = s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  BAD_WORDS.forEach((re) => (t = t.replace(re, "***")));
  return t.slice(0, 2000);
};

const cleanAddress = (s: string) =>
  s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

const formatPhone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 10);
  if (n.length === 0) return "";
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
};

const phoneIsValid = (p: string) => /^0\d{2}-\d{3}-\d{4}$/.test(p);

const money = (n: number) =>
  n.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });

const requestCamera = async (): Promise<boolean> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn("⚠️ อุปกรณ์ไม่รองรับกล้อง");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error: any) {
    console.error("❌ ไม่ได้รับสิทธิ์กล้อง:", error.name, error.message);
    return false;
  }
};

const calculateSupplyCharge = (
  size: SizeKey | "",
  softener: boolean,
  detergent: boolean,
  supplies: SupplyRow[] | null
): number => {
  if (!size || (!softener && !detergent) || !supplies) return 0;
  
  const softPrice = softener ? (supplies.find(s => s.key === 'softener' && s.size === size)?.price || (size === 'S' ? 10 : 15)) : 0;
  const detPrice = detergent ? (supplies.find(s => s.key === 'detergent' && s.size === size)?.price || (size === 'S' ? 10 : 15)) : 0;
  
  return Number(softPrice) + Number(detPrice);
};

const calculatePerSupply = (size: SizeKey | "", picked: boolean, key: 'softener' | 'detergent', supplies: SupplyRow[] | null): number => {
  if (!picked || !size || !supplies) return 0;
  const match = supplies.find(s => s.key === key && s.size === size);
  return match ? Number(match.price) : (size === "S" ? 10 : 15);
};

const getBasePriceFor = (
  size: SizeKey | "",
  service: ServiceType | "",
  basePrices: BasePriceRow[] | null,
  platformFee: number = 20,
): number => {
  if (!size || !service || !basePrices) return 0;
  
  if (service === "wash_and_dry") {
    const washRow = basePrices.find(p => p.size === size && p.svc === "wash_only");
    const dryRow = basePrices.find(p => p.size === size && p.svc === "dry_only");
    if (!washRow && !dryRow) return 0;
    const combinedTotal = (washRow?.price_ex_delivery || 0) + (dryRow?.price_ex_delivery || 0);
    return Math.max(0, combinedTotal - platformFee);
  }

  const direct = basePrices.find((p) => p.size === size && p.svc === service);
  if (direct) return Math.max(0, direct.price_ex_delivery - platformFee);
  
  return 0;
};

const computeWashDry = (
  basket: Basket,
  basePrices: BasePriceRow[] | null,
  platformFee: number = 20,
) => {
  if (!basePrices || !basket.size || !basket.service)
    return { wash: 0, dry: 0, base: 0 };

  if (basket.service === "wash_and_dry") {
    const washRow = basePrices.find(p => p.size === basket.size && p.svc === "wash_only");
    const dryRow = basePrices.find(p => p.size === basket.size && p.svc === "dry_only");
    
    const wPart = washRow?.price_ex_delivery || 0;
    const dPart = dryRow?.price_ex_delivery || 0;
    
    return { 
      wash: wPart, 
      dry: dPart, 
      base: wPart + dPart 
    };
  }

  const row = basePrices.find(
    (p) => p.size === basket.size && p.svc === basket.service,
  );
  if (row) {
    const fullPrice = row.price_ex_delivery;
    if (basket.service === "wash_only")
      return { wash: fullPrice, dry: 0, base: fullPrice };
    if (basket.service === "dry_only")
      return { wash: 0, dry: fullPrice, base: fullPrice };
    
    return { wash: fullPrice / 2, dry: fullPrice / 2, base: fullPrice };
  }
  
  return { wash: 0, dry: 0, base: 0 };
};

export default function HomePage() {
  const slipCamRef = useRef<HTMLInputElement | null>(null);
  const basketCamRef = useRef<HTMLInputElement | null>(null);
  const lastYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const liffInitialized = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [liffReady, setLiffReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [profile, setProfile] = useState<{
    name?: string;
    picture?: string;
    id?: string;
  }>({});

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryMode, setDeliveryMode] =
    useState<DeliveryMode>("pickup_and_return");
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [orderType, setOrderType] = useState<"normal" | "booking">("normal");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [bookingConfigs, setBookingConfigs] = useState<
    { day_of_week: number }[]
  >([]);
  const [googleMapLink, setGoogleMapLink] = useState("");

  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [basketPhoto, setBasketPhoto] = useState<File | null>(null);
  const [basketPreview, setBasketPreview] = useState<string | null>(null);

  const [basePrices, setBasePrices] = useState<BasePriceRow[] | null>(null);
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFeeRow[] | null>(
    null,
  );
  const [supplies, setSupplies] = useState<SupplyRow[] | null>(null);

  const [membershipTier, setMembershipTier] = useState<string>("verified_user");
  const [completedOrdersCount, setCompletedOrdersCount] = useState<number>(0);
  const [hasUsedFreeDelivery, setHasUsedFreeDelivery] = useState<boolean>(false);
  const [freeDeliveryCount, setFreeDeliveryCount] = useState<number>(0);
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  /* ===== State ===== */
  const router = useRouter();
  const [platformFee, setPlatformFee] = useState<number>(20);

  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [userTier, setUserTier] = useState<string>("verified_user");

  const [busy, setBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const [errors, setErrors] = useState<{
    nickname?: string;
    phone?: string;
    address?: string;
  }>({});
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});

  const bookingDays = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return {
        iso: d.toISOString().split("T")[0],
        dayName: d.toLocaleDateString("th-TH", { weekday: "short" }),
        dayNum: d.getDate(),
        dayOfWeek: d.getDay(),
      };
    });
  }, [mounted]);

  const canGoToStep2 = !!(
    address.trim() &&
    (orderType === "normal" || scheduledDate)
  );
  const canGoToStep3 = baskets.length > 0;
  const canSubmit = baskets.length > 0 && !!slip && !!basketPhoto;

  const deliveryBreakdown = useMemo(() => {
    const dfs = deliveryFees || [];
    const sch = dfs.find((d) => d.mode === deliveryMode);
    const c = baskets.length;
    let parts = new Array<number>(c).fill(0);
    if (!sch || c === 0) return parts;
    if (c === 1) parts[0] = sch.fee_1;
    else if (c === 2) {
      parts[0] = sch.fee_2 / 2;
      parts[1] = sch.fee_2 / 2;
    } else {
      parts[0] = sch.fee_2 / 2;
      parts[1] = sch.fee_2 / 2;
      for (let i = 2; i < c; i++) parts[i] = sch.extra_per_basket;
    }
    return parts;
  }, [baskets.length, deliveryFees, deliveryMode]);

  const isFreeSoftener = false;

  const {
    basePrice,
    suppliesTotal,
    deliveryFee,
    totalPlatformFee,
    grandTotal,
    step3Summary,
  } = useMemo(() => {
    if (!basePrices || !deliveryFees)
      return {
        basePrice: 0,
        suppliesTotal: 0,
        deliveryFee: 0,
        totalPlatformFee: 0,
        grandTotal: 0,
        step3Summary: null,
      };
    const bp = baskets.reduce(
      (s, b) => {
        let price = 0;
        if (b.service === "wash_and_dry") {
          const w = basePrices.find(p => p.size === b.size && p.svc === "wash_only")?.price_ex_delivery || 0;
          const d = basePrices.find(p => p.size === b.size && p.svc === "dry_only")?.price_ex_delivery || 0;
          price = w + d;
        } else {
          price = basePrices.find(p => p.size === b.size && p.svc === b.service)?.price_ex_delivery || 0;
        }
        return s + price * (b.qty || 1);
      },
      0,
    );
    const st = baskets.reduce(
      (s, b) =>
        s +
        calculateSupplyCharge(b.size, isFreeSoftener ? false : b.softener, b.detergent, supplies) * (b.qty || 1),
      0,
    );
    const effectivePlatformFee = platformFee;
    const pf = baskets.reduce(
      (s, b) => s + (b.size && b.service ? effectivePlatformFee * (b.qty || 1) : 0),
      0,
    );

    let df = deliveryBreakdown.reduce((s, f) => s + f, 0);
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
    if (selectedCoupon) {
      const isExpired = selectedCoupon.end_date && new Date(selectedCoupon.end_date) < new Date();
      if (!isExpired) {
        if (selectedCoupon.discount_type === "fixed")
          cDisc = selectedCoupon.discount_value;
        else {
          cDisc = Math.round((discountableSubtotal * selectedCoupon.discount_value) / 100);
          if (selectedCoupon.max_discount_amount)
            cDisc = Math.min(cDisc, selectedCoupon.max_discount_amount);
        }

        // Cap discount to never exceed the total amount payable
        // discountableSubtotal + pf is the total cost. mDisc is already applied.
        const maxDiscount = Math.max(0, discountableSubtotal + pf - mDisc);
        if (cDisc > maxDiscount) {
          cDisc = maxDiscount;
        }

        cLabel = `คูปอง ${selectedCoupon.code}`;
      }
    }
    const disc = mDisc + cDisc;
    // Grand Total = Discountable items - Discount + Platform Fee
    const gt = Math.max(0, discountableSubtotal - disc + pf);
    
    const summary = {
      wash: baskets.reduce(
        (s, b) => s + computeWashDry(b, basePrices, platformFee).wash * (b.qty || 1),
        0,
      ),
      dry: baskets.reduce(
        (s, b) => s + computeWashDry(b, basePrices, platformFee).dry * (b.qty || 1),
        0,
      ),
      supplies: st,
      softener: baskets.reduce(
        (s, b) => s + calculatePerSupply(b.size, isFreeSoftener ? false : b.softener, 'softener', supplies) * (b.qty || 1),
        0,
      ),
      detergent: baskets.reduce(
        (s, b) => s + calculatePerSupply(b.size, b.detergent, 'detergent', supplies) * (b.qty || 1),
        0,
      ),
      deliveryBeforeDiscount: df,
      discount: disc,
      discountLabel: [mLabel, cLabel].filter(Boolean).join(" + "),
      platformFee: pf,
      grandTotal: gt,
    };
    return {
      basePrice: bp,
      suppliesTotal: st,
      deliveryFee: df,
      totalPlatformFee: pf,
      grandTotal: gt,
      step3Summary: summary,
    };
  }, [
    baskets,
    basePrices,
    deliveryFees,
    deliveryBreakdown,
    membershipTier,
    completedOrdersCount,
    hasUsedFreeDelivery,
    freeDeliveryCount,
    platformFee,
    selectedCoupon,
    supplies,
  ]);

  const orderTotal = basePrice + suppliesTotal + totalPlatformFee + deliveryFee;

  const basketSummaries = useMemo(() => {
    return baskets.map((b, idx) => {
      const q = b.qty || 1,
        { wash, dry } = computeWashDry(b, basePrices, platformFee);
      const soft = calculatePerSupply(b.size, isFreeSoftener ? false : b.softener, 'softener', supplies),
        det = calculatePerSupply(b.size, b.detergent, 'detergent', supplies);
      const delivery = deliveryBreakdown[idx] || 0;
      return {
        id: b.id,
        size: b.size || "-",
        service: b.service || "-",
        q,
        wash,
        dry,
        supply: soft + det,
        delivery,
        subtotal: (wash + dry + soft + det + platformFee) * q + delivery,
      };
    });
  }, [baskets, basePrices, deliveryBreakdown, platformFee, membershipTier, supplies]);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || liffInitialized.current) return;
    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_HOME!;
        await liff.init({ liffId });
        liffInitialized.current = true;
        if (!liff.isLoggedIn()) {
          setIsLoggingIn(true);
          await liff.login({ redirectUri: window.location.origin });
          return;
        }
        const p = await liff.getProfile();
        setProfile({
          id: p.userId,
          name: p.displayName,
          picture: p.pictureUrl,
        });
        setIsLoggingIn(false);
        setLiffReady(true);
        if (!sessionStorage.getItem("line_synced")) {
          const res = await fetch("/api/auth/line-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              line_id: p.userId,
              name: p.displayName,
              picture: p.pictureUrl,
            }),
          });
          const data = await res.json();
          if (res.ok) {
            sessionStorage.setItem("line_synced", "1");
            sessionStorage.setItem("user_id", data.user_id);
            const { data: ud } = await supa
              .from("users")
              .select("contact_name, contact_phone, contact_address")
              .eq("id", data.user_id)
              .single();
            if (ud) {
              if (ud.contact_name) setNickname(ud.contact_name);
              if (ud.contact_phone) setPhone(formatPhone(ud.contact_phone));
              if (ud.contact_address) setAddress(ud.contact_address);
            }
          }
        }
      } catch (err) {
        console.error(err);
        setLiffReady(true);
      }
    };
    init();
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !liffReady) return;
    const run = async () => {
      try {
        await reloadPricing();

        // Load draft from localStorage
        const draft = localStorage.getItem("order_draft");
        if (draft) {
          try {
            const d = JSON.parse(draft);
            if (d.currentStep) setCurrentStep(d.currentStep);
            if (d.nickname) setNickname(d.nickname);
            if (d.phone) setPhone(d.phone);
            if (d.address) setAddress(d.address);
            if (d.deliveryMode) setDeliveryMode(d.deliveryMode);
            if (d.baskets) setBaskets(d.baskets);
            if (d.note) setNote(d.note);
            if (d.consent) setConsent(d.consent);
            if (d.orderType) setOrderType(d.orderType);
            if (d.scheduledDate) setScheduledDate(d.scheduledDate);
            if (d.googleMapLink) setGoogleMapLink(d.googleMapLink);
          } catch (e) {
            console.error("Restore draft error", e);
          }
        }

        const promises = [];
        const uid = sessionStorage.getItem("user_id");

        if (uid) {
          promises.push(
            fetch(`/api/membership?user_id=${uid}`)
              .then((r) => r.json())
              .then((d) => {
                setMembershipTier(d.user.membership_tier || "verified_user");
                setCompletedOrdersCount(d.user.completed_orders_count || 0);
                setHasUsedFreeDelivery(!!d.user.has_used_free_delivery);
                setFreeDeliveryCount(d.user.free_delivery_count || 0);
                setAvailablePoints(d.points.available_points || 0);
                const u = d.user;
                // Set profile values ONLY if current field is empty (preserves typed draft)
                setNickname((v) => v || u.nickname || u.contact_name || "");
                setPhone((v) => v || formatPhone(u.phone || u.contact_phone || ""));
                setAddress((v) => v || u.contact_address || "");
                setGoogleMapLink((v) => v || u.google_map_link || "");
              })
          );
          promises.push(getUserCoupons(uid).then(setAvailableCoupons));
        }

        // Load pricing configurations (Base Prices, Delivery, Supplies, Platform Fee)
        promises.push(reloadPricing());

        promises.push(
          supa
            .from("booking_configs")
            .select("day_of_week")
            .eq("is_active", true)
            .then((r) => {
              if (r.data) setBookingConfigs(r.data);
            })
        );

        await Promise.all(promises);
      } catch (err) {
        console.error("Error loading initial data:", err);
      } finally {
        setIsDataLoading(false);
      }
    };
    run();
  }, [liffReady, mounted]);

  // Persistent Draft Saver (Debounced)
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      const draft = {
        currentStep,
        nickname,
        phone,
        address,
        deliveryMode,
        baskets,
        note,
        consent,
        orderType,
        scheduledDate,
        googleMapLink,
      };
      localStorage.setItem("order_draft", JSON.stringify(draft));
    }, 1000);
    return () => clearTimeout(t);
  }, [
    mounted,
    currentStep,
    nickname,
    phone,
    address,
    deliveryMode,
    baskets,
    note,
    consent,
    orderType,
    scheduledDate,
    googleMapLink,
  ]);

  const reloadPricing = async () => {
    try {
      const [bp, df, sp, pf] = await Promise.allSettled([
        supa
          .from("laundry_base_prices")
          .select("size, svc, price_ex_delivery")
          .eq("active", true),
        supa.from("delivery_fee_schedules").select("*").eq("active", true),
        supa.from("laundry_supplies").select("key, size, price").eq("active", true),
        supa.from("platform_fees").select("amount").eq("fee_type", "standard").single(),
      ]);
      if (bp.status === "fulfilled" && !bp.value.error)
        setBasePrices(bp.value.data);
      if (df.status === "fulfilled" && !df.value.error)
        setDeliveryFees(df.value.data);
      if (sp.status === "fulfilled" && !sp.value.error)
        setSupplies(sp.value.data);
      if (pf.status === "fulfilled" && !pf.value.error && pf.value.data)
        setPlatformFee(pf.value.data.amount);
    } catch (e) {
      console.error(e);
    }
  };

  const addBasket = () =>
    setBaskets((p) => [
      ...p,
      {
        id: Date.now(),
        size: "",
        service: "",
        softener: false,
        detergent: false,
        qty: 1,
      },
    ]);
  const removeBasket = (id: number) =>
    setBaskets((p) => p.filter((b) => b.id !== id));

  const applyCoupon = (c: any) => {
    if (c.is_expired) {
      Swal.fire("คูปองหมดอายุ", "คูปองนี้หมดอายุการใช้งานแล้ว", "error");
      return;
    }
    const sub = basePrice + suppliesTotal + deliveryFee;
    if (c.min_order_amount && sub < c.min_order_amount) {
      Swal.fire(
        "ยอดไม่ถึง",
        `คูปองนี้ต้องการยอดรวมอย่างน้อย ${money(c.min_order_amount)}`,
        "warning",
      );
      return;
    }
    setSelectedCoupon(c);
  };
  const updateBasket = (id: number, field: keyof Basket, value: any) =>
    setBaskets((p) =>
      p.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  const toggleRow = (id: number) =>
    setOpenRows((p) => ({ ...p, [id]: !p[id] }));

  const validateStep1 = () => {
    const e: any = {};
    if (!nickname.trim()) e.nickname = "กรอกชื่อเล่น";
    if (!phoneIsValid(phone)) e.phone = "รูปแบบเบอร์ไม่ถูกต้อง";
    if (!address.trim()) e.address = "กรอกที่อยู่";
    setErrors(e);
    if (Object.keys(e).length > 0) return false;
    if (!consent) {
      Swal.fire("แจ้งเตือน", "⚠️ กรุณายินยอมเงื่อนไข", "warning");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (baskets.length === 0) {
      Swal.fire("แจ้งเตือน", "⚠️ กรุณาเพิ่มอย่างน้อย 1 ตะกร้า", "warning");
      return false;
    }
    for (let i = 0; i < baskets.length; i++) {
      const b = baskets[i];
      if (!b.size) {
        Swal.fire(
          "แจ้งเตือน",
          `⚠️ ตะกร้าที่ ${i + 1} ยังไม่ได้เลือกขนาด`,
          "warning",
        );
        return false;
      }
      if (!b.service) {
        Swal.fire(
          "แจ้งเตือน",
          `⚠️ ตะกร้าที่ ${i + 1} ยังไม่ได้เลือกบริการ`,
          "warning",
        );
        return false;
      }
    }
    return true;
  };

  const uploadToBucket = async (bucket: string, file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supa.storage.from(bucket).upload(path, file);
    if (error) throw error;
    return supa.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const [slipUrl, basketUrl] = await Promise.all([
        uploadToBucket(BUCKET_SLIPS, slip!),
        uploadToBucket(BUCKET_BASKETS, basketPhoto!),
      ]);
      const uid = sessionStorage.getItem("user_id");
      const totals = step3Summary!;
      const payload = {
        customer_id: uid,
        contact_name: nickname.trim(),
        contact_phone: phone.replace(/\D/g, ""),
        status: "accepted",
        base_price: basePrice,
        wash_price: totals.wash,
        dry_price: totals.dry,
        supplies_total: suppliesTotal,
        delivery_fee: deliveryFee,
        platform_fee: totalPlatformFee,
        discount_amount: totals.discount,
        discount_reason: totals.discountLabel || null,
        subtotal_before_discount:
          basePrice + suppliesTotal + deliveryFee + totalPlatformFee,
        total_amount: grandTotal,
        note: note ? cleanNote(note) : null,
        slip_url: slipUrl,
        delivery: { 
          address: cleanAddress(address), 
          mode: deliveryMode,
          google_map_link: googleMapLink.trim() || null
        },
        addons: { baskets, basket_photo_url: basketUrl },
        order_type: orderType,
        scheduled_date: orderType === "booking" ? scheduledDate : null,
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      const orderData = await res.json();
      if (selectedCoupon && uid)
        await markCouponUsed(
          uid,
          selectedCoupon.code,
          orderData.data?.id || "unknown",
        );
      await Swal.fire("สำเร็จ 🎉", "ส่งออเดอร์เรียบร้อยแล้ว", "success");
      localStorage.removeItem("order_draft");
      sessionStorage.removeItem("orderForm");
      window.location.reload();
    } catch (e: any) {
      Swal.fire("ผิดพลาด", e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const checkImage = (f: File) => (f.size > MAX_IMG ? "ไฟล์ใหญ่เกินไป" : null);

  const clickCamera = (ref: any) => {
    if (!ref.current) return;
    ref.current.setAttribute("capture", "environment");
    ref.current.click();
  };
  const clickGallery = (ref: any) => {
    if (!ref.current) return;
    ref.current.removeAttribute("capture");
    ref.current.click();
  };

  if (!mounted) return null;

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 [--tint:#0A84FF]">
      {(isLoggingIn || isDataLoading) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-white transition-opacity duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[color:var(--tint)]" />
            <p className="text-sm text-slate-600 animate-pulse">
              {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "กำลังเตรียมข้อมูล..."}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto min-h-[100dvh] flex flex-col">
        <header
          className={`sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200/60 transition-transform ${
            hideHeader ? "-translate-y-full" : "translate-y-0"
          }`}
        >
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h1 className="text-base font-medium text-slate-900">สั่งซักผ้า</h1>
            <div className="flex items-center gap-3">
              {membershipTier !== "verified_user" && (
                <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${
                  membershipTier === "gold" ? "bg-yellow-100 text-yellow-600 border border-yellow-200" :
                  membershipTier === "silver" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                  "bg-blue-100 text-blue-600 border border-blue-200"
                }`}>
                  <Crown size={10} />
                  {membershipTier} {freeDeliveryCount > 0 && `(ส่งฟรี: ${freeDeliveryCount})`}
                </div>
              )}
              <div className="flex items-center gap-2" aria-label="สถานะขั้นตอน">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={`h-2 w-2 rounded-full ${
                      s <= currentStep ? "bg-[color:var(--tint)]" : "bg-slate-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 pb-40">
          {currentStep === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (validateStep1()) setCurrentStep(2);
              }}
              noValidate
              className="space-y-6"
            >
              <div className="space-y-4">
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ชื่อเล่น"
                  className={`w-full h-11 rounded-xl px-4 text-[15px] bg-white ring-1 focus:outline-none ${
                    errors.nickname
                      ? "ring-rose-300"
                      : "ring-slate-200/60 focus:ring-[color:var(--tint)]/40"
                  }`}
                />
                {errors.nickname && (
                  <p className="text-xs text-rose-600">{errors.nickname}</p>
                )}

                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="เบอร์โทรศัพท์"
                  className={`w-full h-11 rounded-xl px-4 text-[15px] bg-white ring-1 focus:outline-none ${
                    errors.phone
                      ? "ring-rose-300"
                      : "ring-slate-200/60 focus:ring-[color:var(--tint)]/40"
                  }`}
                />
                {errors.phone && (
                  <p className="text-xs text-rose-600">{errors.phone}</p>
                )}

                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="ที่อยู่รับ–ส่ง เช่น หอพักสุรนิเวศ 11"
                  className={`w-full rounded-xl px-4 py-3 text-[15px] bg-white ring-1 focus:outline-none ${
                    errors.address
                      ? "ring-rose-300"
                      : "ring-slate-200/60 focus:ring-[color:var(--tint)]/40"
                  }`}
                />
                {errors.address && (
                  <p className="text-xs text-rose-600">{errors.address}</p>
                )}

                <div className="relative">
                  <input
                    id="googleMapLink"
                    type="url"
                    value={googleMapLink}
                    onChange={(e) => setGoogleMapLink(e.target.value)}
                    placeholder="Google Map Link (ถ้ามี)"
                    className="w-full h-11 rounded-xl px-4 pl-10 text-[15px] bg-white ring-1 ring-slate-200/60 focus:outline-none focus:ring-[color:var(--tint)]/40 text-slate-900"
                  />
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
              </div>

              {/* Booking System Integration */}
              <div className="pt-2 border-t border-slate-100/60">
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-bold text-slate-700 tracking-tight">รูปแบบการสั่ง</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderType("normal");
                        setScheduledDate("");
                      }}
                      className={`h-11 rounded-xl text-sm font-bold transition-all ${
                        orderType === "normal"
                          ? "bg-[color:var(--tint)] text-white shadow-sm"
                          : "bg-slate-50 text-slate-500 border border-slate-100"
                      }`}
                    >
                      สั่งด่วน
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("booking")}
                      className={`h-11 rounded-xl text-sm font-bold transition-all ${
                        orderType === "booking"
                          ? "bg-[color:var(--tint)] text-white shadow-sm"
                          : "bg-slate-50 text-slate-500 border border-slate-100"
                      }`}
                    >
                      จองล่วงหน้า
                    </button>
                  </div>
                  
                  {orderType === "booking" && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[11px] text-slate-500 mb-2 font-medium">
                        {membershipTier === "gold" 
                          ? "✨ สิทธิ์ Gold Rank: คุณสามารถเลือกจองวันไหนก็ได้" 
                          : "จองได้วันจันทร์และวันพุธ (วันอื่นขึ้นอยู่กับโควต้า)"}
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                        {bookingDays.map((d) => {
                          const isMandatory = [1, 3].includes(d.dayOfWeek);
                          const isAvailable =
                            membershipTier === "gold" ||
                            isMandatory ||
                            bookingConfigs.some((c) => c.day_of_week === d.dayOfWeek);
                          return (
                            <button
                              key={d.iso}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => setScheduledDate(d.iso)}
                              className={`flex-shrink-0 w-14 h-16 rounded-2xl flex flex-col items-center justify-center transition-all border snap-start ${
                                scheduledDate === d.iso
                                  ? "bg-[color:var(--tint)] border-[color:var(--tint)] text-white shadow-md shadow-blue-100"
                                  : isAvailable
                                    ? "bg-white border-slate-200 text-slate-700"
                                    : "bg-slate-50 border-slate-100 text-slate-300 opacity-60"
                              }`}
                            >
                              <span className="text-[10px] font-bold uppercase">{d.dayName}</span>
                              <span className="text-lg font-black">{d.dayNum}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Selection */}
              <div className="pt-2 border-t border-slate-100/60">
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-bold text-slate-700 tracking-tight">เลือกวิธีรับ–ส่งผ้า</p>
                  <div role="radiogroup" className="grid grid-cols-2 gap-2">
                    <label
                      className={`h-11 rounded-xl grid place-items-center text-sm font-bold cursor-pointer transition-all border ${
                        deliveryMode === "pickup_and_return"
                          ? "bg-[color:var(--tint)] text-white border-[color:var(--tint)] shadow-sm"
                          : "bg-slate-50 text-slate-500 border-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMode"
                        className="sr-only"
                        checked={deliveryMode === "pickup_and_return"}
                        onChange={() => setDeliveryMode("pickup_and_return")}
                      />
                      ไปรับ + ส่งคืน
                    </label>

                    <label
                      className={`h-11 rounded-xl grid place-items-center text-sm font-bold cursor-pointer transition-all border ${
                        deliveryMode === "pickup_only"
                          ? "bg-[color:var(--tint)] text-white border-[color:var(--tint)] shadow-sm"
                          : "bg-slate-50 text-slate-500 border-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMode"
                        className="sr-only"
                        checked={deliveryMode === "pickup_only"}
                        onChange={() => setDeliveryMode("pickup_only")}
                      />
                      ไปรับอย่างเดียว
                    </label>
                  </div>
                </div>
              </div>


              <div className="pt-2 border-t border-slate-100/60">
                <div
                  className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 cursor-pointer active:scale-[0.99] transition-all"
                  onClick={() => setConsent(!consent)}
                >
                  <div className="pt-0.5">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 rounded-lg border-slate-300 text-[color:var(--tint)] focus:ring-[color:var(--tint)]"
                    />
                  </div>
                  <div className="text-[13px] text-slate-600 leading-relaxed select-none">
                    ฉันได้อ่านและยอมรับ
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTerms(true);
                      }}
                      className="text-[color:var(--tint)] font-bold mx-1 hover:underline text-[13px]"
                    >
                      เงื่อนไขการใช้บริการ
                    </button>
                    และ
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrivacy(true);
                      }}
                      className="text-[color:var(--tint)] font-bold ml-1 hover:underline text-[13px]"
                    >
                      นโยบายความเป็นส่วนตัว
                    </button>
                    ของมาซักดิ่
                  </div>
                </div>
              </div>

              <div
                className="fixed left-0 right-0 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pt-10 pb-4 z-40"
                style={{
                  bottom: "80px",
                }}
              >
                <div className="max-w-md mx-auto">
                  <button
                    type="submit"
                    disabled={!canGoToStep2}
                    className={`w-full h-11 rounded-full text-sm font-bold shadow-lg transition-all active:scale-95 ${
                      canGoToStep2
                        ? "bg-[color:var(--tint)] text-white shadow-blue-100"
                        : "bg-slate-200 text-slate-400 shadow-none pointer-events-none"
                    }`}
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              {baskets.length === 0 && (
                <div className="py-8 flex justify-center">
                  <button
                    type="button"
                    onClick={addBasket}
                    className="h-11 px-8 rounded-full bg-[color:var(--tint)] text-sm text-white shadow active:scale-95"
                  >
                    เพิ่มตะกร้า
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {baskets.map((b, idx) => (
                  <section
                    key={b.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium">ตะกร้า {idx + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeBasket(b.id)}
                        className="text-xs text-rose-600 underline"
                      >
                        ลบ
                      </button>
                    </div>

                    <div className="mb-3">
                      <p className="mb-2 text-xs text-slate-500 font-medium">
                        ขนาด
                      </p>
                      <div className="flex gap-2">
                        {(
                          [
                            { key: "S", label: "S", desc: "20–30 ชิ้น" },
                            { key: "M", label: "M", desc: "35–45 ชิ้น" },
                            { key: "L", label: "L", desc: "45 ขึ้นไป" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => updateBasket(b.id, "size", opt.key)}
                            className={`flex flex-col items-center justify-center h-14 w-full rounded-xl border text-sm transition-all ${
                              b.size === opt.key
                                ? "bg-[color:var(--tint)] text-white border-[color:var(--tint)]"
                                : "bg-white text-slate-700 border-slate-200"
                            }`}
                          >
                            <span className="font-bold text-sm">{opt.label}</span>
                            <span className="text-[11px] opacity-80">
                              {opt.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="mb-2 text-xs text-slate-500 font-medium">
                        บริการ
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { label: "ซัก+อบ", value: "wash_and_dry" },
                            { label: "ซัก", value: "wash_only" },
                            { label: "อบ", value: "dry_only" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateBasket(b.id, "service", opt.value)
                            }
                            className={`h-10 rounded-xl text-sm font-medium transition-all ${
                              b.service === opt.value
                                ? "bg-[color:var(--tint)] text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="mb-2 text-xs text-slate-500 font-medium">
                        น้ำยาเพิ่มเติม
                      </p>
                      <div className="flex gap-2">
                        {(() => {
                          const price =
                            b.size === "S"
                              ? 10
                              : b.size === "M" || b.size === "L"
                                ? 15
                                : 0;
                          const priceText = price > 0 ? `+${price}฿` : "";
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateBasket(b.id, "softener", !b.softener)
                                }
                                className={`flex-1 h-10 rounded-full px-3 text-sm font-bold transition-all ${
                                  b.softener
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {b.softener
                                  ? `ปรับผ้านุ่ม ✓`
                                  : `ปรับผ้านุ่ม ${priceText}`}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateBasket(b.id, "detergent", !b.detergent)
                                }
                                className={`flex-1 h-10 rounded-full px-3 text-sm font-bold transition-all ${
                                  b.detergent
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {b.detergent
                                  ? `ผงซักฟอก ✓`
                                  : `ผงซักฟอก ${priceText}`}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              {baskets.length > 0 && (
                <div className="mt-1 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addBasket}
                      className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-900 font-bold"
                    >
                      +
                    </button>
                    <span className="text-sm text-slate-600 font-medium">
                      เพิ่มตะกร้า
                    </span>
                  </div>
                  <div className="ml-auto text-right">
                    <span className="text-sm text-slate-600 font-medium">
                      รวม {baskets.length} ตะกร้า
                    </span>
                  </div>
                </div>
              )}

              {baskets.length > 0 && (
                <div className="pt-2 border-t border-slate-100/60">
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-bold text-slate-700 tracking-tight">
                      หมายเหตุเพิ่มเติม
                    </p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(cleanNote(e.target.value))}
                      rows={3}
                      placeholder="ซักแยกสี แยกตะกร้า ฯลฯ"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] focus:border-[color:var(--tint)] focus:ring-1 focus:ring-[color:var(--tint)] outline-none resize-none bg-white placeholder:text-slate-400"
                      maxLength={2000}
                    />
                  </div>
                </div>
              )}

              {baskets.length > 0 && (
                <div
                  className="fixed left-0 right-0 bg-gradient-to-t from-white via-white/80 to-transparent px-4 pt-10 pb-4 z-40"
                  style={{
                    bottom: "80px",
                  }}
                >
                  <div className="max-w-md mx-auto flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[color:var(--tint)] text-white active:scale-95 transition-all shadow-lg shadow-blue-100"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-500 font-medium tracking-tight">
                        ราคารวม
                      </p>
                      <p className="text-base font-bold truncate">
                        {money(grandTotal)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (validateStep2()) setCurrentStep(3);
                      }}
                      className="h-11 rounded-2xl px-6 text-sm font-bold bg-[color:var(--tint)] text-white shadow active:scale-95"
                    >
                      ไปชำระเงิน
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 &&
            step3Summary &&
            (() => {
              const totals = step3Summary!;
              const totalServicePrice =
                (totals.wash || 0) +
                (totals.dry || 0) +
                (totals.supplies || 0) +
                (totals.deliveryBeforeDiscount || 0);

              const detailed = baskets.map((b, idx) => {
                const q = b.qty || 1;
                const { wash, dry } = computeWashDry(
                  b,
                  basePrices,
                  platformFee,
                );
                const soft = calculatePerSupply(b.size, b.softener, 'softener', supplies);
                const det = calculatePerSupply(b.size, b.detergent, 'detergent', supplies);
                const suppliesCostLine = soft + det;
                const shipShare = deliveryBreakdown[idx] || 0;
                               // Calculate portions
                const servicePriceExFee = (wash + dry + suppliesCostLine) * q + shipShare;
                const effectiveLineFee = platformFee;
                const lineFee = effectiveLineFee * q;

                // ยอดก่อนหักส่วนลด (รวมค่าธรรมเนียมแล้ว - ตามสิทธิ์สมาชิก)
                const lineSubtotal = servicePriceExFee + lineFee;

                // Calculate share of discount (only on services/supplies/delivery)
                const shareOfDiscount =
                  totalServicePrice > 0
                    ? Math.round(
                        (servicePriceExFee / totalServicePrice) *
                          totals.discount,
                      )
                    : 0;
                
                // ยอดหลังหักส่วนลด (ยอดบริการหักส่วนลด + ค่าธรรมเนียมเต็มจำนวน)
                const discountedLineSubtotal = Math.max(
                  0,
                  (servicePriceExFee - shareOfDiscount) + lineFee,
                );

                const washPrice = wash;
                const dryPrice = dry;

                return {
                  id: b.id,
                  idx,
                  size: b.size,
                  service: b.service,
                  q,
                  pricePerUnit: {
                    wash: washPrice,
                    dry: dryPrice,
                    soft,
                    det,
                    supplies: suppliesCostLine,
                    platformFee,
                    shipShare,
                    perUnitBeforeShip: washPrice + dryPrice + suppliesCostLine + platformFee,
                  },
                  lineSubtotal,
                  discountedLineSubtotal,
                  shareOfDiscount,
                };
              });

              return (
                <div className="flex flex-col gap-6 pb-48 animate-in fade-in slide-in-from-right-4 text-zinc-900">
                  {/* Bill Card (Receipt Style) */}
                  <div className="bg-white rounded-b-2xl shadow-sm border border-zinc-200 overflow-hidden relative">
                    <div
                      className="h-2 bg-[color:var(--tint)]"
                      style={{
                        clipPath:
                          "polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)",
                      }}
                    ></div>

                    <div className="p-6">
                      {/* Receipt Header */}
                      <div className="text-center pb-6 border-b border-dashed border-zinc-300">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
                          <Receipt className="w-8 h-8 text-[color:var(--tint)]" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-900">
                          ใบสรุปรายการสั่งซื้อ
                        </h2>
                        <div className="mt-2 flex flex-col items-center gap-1">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${orderType === "booking" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                          >
                            {orderType === "booking"
                              ? "📅 จองล่วงหน้า"
                              : "⚡ สั่งด่วน (ปกติ)"}
                          </span>
                          {orderType === "booking" && scheduledDate && (
                            <p className="text-xs text-zinc-500 font-bold">
                              วันรับบริการ:{" "}
                              {new Date(scheduledDate).toLocaleDateString(
                                "th-TH",
                                {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Service Summary (The "ข้อมูลเดิม") */}
                      <div className="py-6 space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">ค่าซักรวม</span>
                            <span className="font-bold">
                              {money(totals.wash)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">ค่าอบรวม</span>
                            <span className="font-bold">
                              {money(totals.dry)}
                            </span>
                          </div>
                          {totals.supplies > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">
                                  ค่าน้ำยาเพิ่มเติมรวม
                                </span>
                                <span className="font-bold">
                                  {money(totals.supplies)}
                                </span>
                              </div>
                              <div className="pl-4 text-xs text-zinc-400 space-y-0.5">
                                <div className="flex justify-between">
                                  <span>• ปรับผ้านุ่ม</span>
                                  <span>{money(totals.softener)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>• ผงซักฟอก</span>
                                  <span>{money(totals.detergent)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">
                              ค่าธรรมเนียมระบบ
                            </span>
                            <span className="font-bold">
                              {money(totals.platformFee)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 mt-2 border-t border-zinc-100">
                            <span className="text-zinc-500 flex items-center gap-1.5 font-medium">
                              <Truck className="w-4 h-4" /> ค่าส่ง (
                              {baskets.length} ตะกร้า)
                            </span>
                            <span className="font-bold">
                              {money(totals.deliveryBeforeDiscount)}
                            </span>
                          </div>

                          {totals.discount > 0 && (
                            <div className="flex justify-between text-sm text-[color:var(--tint)] font-bold pt-1">
                              <div className="flex flex-col">
                                <span>ส่วนลด</span>
                                <span className="text-[11px] opacity-80">
                                  {totals.discountLabel}
                                </span>
                              </div>
                              <span>-{money(totals.discount)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Total Section */}
                      <div className="pt-6 border-t-2 border-dashed border-zinc-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-zinc-900">
                            ยอดชำระสุทธิ
                          </span>
                          <div className="text-right">
                            <span className="text-2xl font-black text-[color:var(--tint)]">
                              {money(totals.grandTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="h-2 bg-zinc-50"
                      style={{
                        clipPath:
                          "polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)",
                      }}
                    ></div>
                  </div>

                  {/* Coupon Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                      <Ticket className="w-5 h-5 text-[color:var(--tint)]" />
                      <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                        คูปองส่วนลด
                      </h3>
                    </div>

                    {selectedCoupon ? (
                      <div className="px-1">
                        <div className="relative w-full h-26 flex drop-shadow-sm animate-in slide-in-from-top-2 duration-500 group">
                          {/* Front Notch */}
                          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.05)]"></div>

                          {/* Left Section (Emerald/Green for Applied) */}
                          <div 
                            className="flex-1 pl-7 pr-3 py-4 relative flex flex-col justify-between overflow-hidden text-white"
                            style={{
                                backgroundImage: `radial-gradient(circle at 0 0, transparent 10px, #10b981 10.5px), radial-gradient(circle at 0 100%, transparent 10px, #10b981 10.5px)`,
                                backgroundPosition: 'top left, bottom left',
                                backgroundSize: '100% 51%',
                                backgroundRepeat: 'no-repeat'
                            }}
                          >
                            <div className="z-10 flex items-start justify-between text-left">
                              <div className="flex flex-col gap-0.5">
                                <h3 className="text-white/90 text-[9px] font-black uppercase tracking-wider text-left">
                                  {selectedCoupon.description || 'APPLIED VOUCHER'}
                                </h3>
                                <div className="flex items-baseline gap-1">
                                  <h2 className="text-3xl font-black tracking-tighter leading-none">
                                    {selectedCoupon.discount_type === "percent" ? `${selectedCoupon.discount_value}%` : money(selectedCoupon.discount_value).replace('฿', '')}
                                  </h2>
                                  <span className="text-sm font-bold text-white/80">OFF</span>
                                </div>
                              </div>
                            </div>
                            <div className="z-10 flex items-center gap-1.5 text-white/80">
                              <CheckCircle className="w-3 h-3" />
                              <p className="text-[9px] font-black uppercase tracking-widest">Selected</p>
                            </div>
                          </div>

                          {/* Divider Area */}
                          <div className="relative w-0 flex flex-col items-center">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[45%] w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)]"></div>
                            <div className="h-full border-l-[3px] border-dotted border-white/40 absolute left-1/2 -translate-x-1/2 z-30"></div>
                            <div className="h-full border-l-[3px] border-dotted border-emerald-200 absolute left-1/2 -translate-x-1/2 z-10"></div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[45%] w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"></div>
                          </div>

                          {/* Right Section */}
                          <div 
                            className="w-28 p-3 flex flex-col items-center justify-center gap-1 relative bg-white border-r border-zinc-100"
                            style={{
                                backgroundImage: `radial-gradient(circle at 100% 0, transparent 10px, #ffffff 10.5px), radial-gradient(circle at 100% 100%, transparent 10px, #ffffff 10.5px)`,
                                backgroundPosition: 'top right, bottom right',
                                backgroundSize: '100% 51%',
                                backgroundRepeat: 'no-repeat'
                            }}
                          >
                            <div className="text-center">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">CODE</span>
                              <div className="font-mono font-black text-emerald-900 text-[13px] tracking-tighter">{selectedCoupon.code}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedCoupon(null)}
                              className="w-full py-1 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-tighter active:scale-95 transition-all border border-rose-100"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableCoupons.length > 0 ? (
                          <div className="space-y-4 px-1">
                            {availableCoupons.map((c) => {
                              const sub = basePrice + suppliesTotal + deliveryFee;
                              const isDisabled = (c.min_order_amount && sub < c.min_order_amount) || c.is_expired;
                              
                              // Check Role Eligibility
                              const allowed = typeof c.allowed_roles === 'string' ? JSON.parse(c.allowed_roles) : (c.allowed_roles || ['all']);
                              const isForEveryone = allowed.includes('all');
                              const isEligible = isForEveryone || allowed.includes(userTier);
                              
                              const handleCouponAction = () => {
                                  if (!isEligible) {
                                      // Redirect to membership
                                       router.push("/Users/Membership");
                                       return;
                                  }
                                  applyCoupon(c);
                              };

                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  disabled={!!isDisabled && isEligible} // Disable if invalid amount/expired, BUT allow click if ineligible (to redirect)
                                  onClick={handleCouponAction}
                                  className={`relative w-full h-26 flex drop-shadow-sm transition-all active:scale-[0.98] group ${
                                    isDisabled && isEligible ? "opacity-60 grayscale cursor-not-allowed" : "hover:-translate-y-1"
                                  }`}
                                >
                                  {/* Front Notch */}
                                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.05)]"></div>

                                  {/* Left Section (Blue) */}
                                  <div 
                                    className="flex-1 pl-7 pr-3 py-4 relative flex flex-col justify-between overflow-hidden text-white"
                                    style={{
                                        backgroundImage: !isEligible 
                                            ? `radial-gradient(circle at 0 0, transparent 10px, #334155 10.5px), radial-gradient(circle at 0 100%, transparent 10px, #334155 10.5px)`
                                            : isDisabled 
                                                ? `radial-gradient(circle at 0 0, transparent 10px, #94a3b8 10.5px), radial-gradient(circle at 0 100%, transparent 10px, #94a3b8 10.5px)`
                                                : `radial-gradient(circle at 0 0, transparent 10px, #1257FF 10.5px), radial-gradient(circle at 0 100%, transparent 10px, #1257FF 10.5px)`,
                                        backgroundPosition: 'top left, bottom left',
                                        backgroundSize: '100% 51%',
                                        backgroundRepeat: 'no-repeat'
                                    }}
                                  >
                                    <div className="z-10 flex items-start justify-between">
                                      <div className="flex flex-col gap-0.5 text-left">
                                        <h3 className="text-white/90 text-[9px] font-black uppercase tracking-wider">
                                          {c.description || 'LADY VOUCHER'}
                                        </h3>
                                        {!isEligible && (
                                            <span className="px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[8px] font-black rounded uppercase flex items-center gap-1 w-fit mb-1">
                                                <Crown size={8} /> Exclusive
                                            </span>
                                        )}
                                        {isForEveryone && isEligible && (
                                            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[8px] font-bold rounded uppercase w-fit mb-1">
                                                Everyone
                                            </span>
                                        )}
                                        <div className="flex items-baseline gap-1">
                                          <h2 className="text-3xl font-black tracking-tighter leading-none">
                                            {c.discount_type === "percent" ? `${c.discount_value}%` : money(c.discount_value).replace('฿', '')}
                                          </h2>
                                          <span className="text-sm font-bold text-white/80">OFF</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="z-10 flex items-center gap-1 text-white/70">
                                      <CalendarClock className="w-3 h-3" />
                                      <p className="text-[8px] font-medium tracking-wide">
                                        Valid: {c.end_date ? new Date(c.end_date).toLocaleDateString('en-GB') : 'No Expiry'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Divider Area */}
                                  <div className="relative w-0 flex flex-col items-center">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[45%] w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)]"></div>
                                    <div className="h-full border-l-[3px] border-dotted border-white/40 absolute left-1/2 -translate-x-1/2 z-30"></div>
                                    <div className="h-full border-l-[3px] border-dotted border-slate-200 absolute left-1/2 -translate-x-1/2 z-10"></div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[45%] w-4 h-4 bg-zinc-50 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"></div>
                                  </div>

                                  {/* Right Section */}
                                  <div 
                                    className="w-28 p-3 flex flex-col items-center justify-center gap-1 border-r border-slate-100 relative bg-white"
                                    style={{
                                        backgroundImage: `radial-gradient(circle at 100% 0, transparent 10px, #ffffff 10.5px), radial-gradient(circle at 100% 100%, transparent 10px, #ffffff 10.5px)`,
                                        backgroundPosition: 'top right, bottom right',
                                        backgroundSize: '100% 51%',
                                        backgroundRepeat: 'no-repeat'
                                    }}
                                  >
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">CODE</span>
                                    <div className={`font-mono font-black text-[13px] tracking-tight truncate mb-1.5 ${isDisabled ? 'text-slate-400' : 'text-slate-800'}`}>
                                      {c.code}
                                    </div>
                                    {!isDisabled ? (
                                      <div className="w-full py-1 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-blue-100 group-hover:bg-slate-900 transition-colors text-center">
                                        ใช้เลย
                                      </div>
                                    ) : !isEligible ? (
                                       <div className="w-full py-1 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-slate-200 transition-colors text-center flex items-center justify-center gap-1">
                                        Unlock
                                      </div>
                                    ) : (
                                      <div className="text-[8px] font-black text-rose-500 uppercase leading-none text-center">
                                        {c.is_expired ? 'หมดอายุ' : `ขาดอีก ${money(c.min_order_amount - sub)}`}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-12 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
                            <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-[15px] text-slate-400 font-bold max-w-[220px] mx-auto leading-tight">
                              คุณไม่มีคูปองที่สามารถใช้ได้ในขณะนี้
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Basket Details (Accordions) */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider px-1">
                      รายละเอียดแต่ละตะกร้า
                    </h3>
                    <div className="space-y-3">
                      {detailed.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-2xl bg-white border border-zinc-100 shadow-sm overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleRow(r.id)}
                            className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${openRows[r.id] ? "bg-zinc-50" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[color:var(--tint)] text-white flex items-center justify-center text-xs font-black">
                                {r.idx + 1}
                              </div>
                              <div className="text-left font-bold text-zinc-800 text-[14px]">
                                ตะกร้า {r.idx + 1}
                                <span className="text-zinc-400 font-medium ml-1">
                                  ({r.size},{" "}
                                  {r.service === "wash_and_dry"
                                    ? "ซัก+อบ"
                                    : r.service === "wash_only"
                                      ? "ซัก"
                                      : "อบ"}
                                  )
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.shareOfDiscount > 0 && (
                                <span className="text-[9px] text-zinc-400 line-through">
                                  {money(r.lineSubtotal)}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-[color:var(--tint)]">
                                {money(r.discountedLineSubtotal)}
                              </span>
                              <svg
                                className={`h-4 w-4 text-zinc-300 transition-transform duration-300 ${openRows[r.id] ? "rotate-180" : ""}`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
                              </svg>
                            </div>
                          </button>

                          {openRows[r.id] && (
                            <div className="px-5 pb-5 pt-1 space-y-1.5 bg-zinc-50 border-t border-zinc-100 text-[13px] text-zinc-500 animate-in fade-in slide-in-from-top-1">
                              <div className="flex justify-between">
                                <span>ค่าซักต่อใบ</span>
                                <span className="font-medium text-zinc-700">
                                  {money(r.pricePerUnit.wash)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>ค่าอบต่อใบ</span>
                                <span className="font-medium text-zinc-700">
                                  {money(r.pricePerUnit.dry)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>ค่าน้ำยาต่อใบ</span>
                                <span className="font-medium text-zinc-700">
                                  {money(r.pricePerUnit.supplies)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>ค่าธรรมเนียมระบบ</span>
                                <span className="font-medium text-zinc-700">
                                  {money(membershipTier !== 'verified_user' ? 0 : platformFee)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>ส่วนแบ่งค่าส่ง</span>
                                <span className="font-medium text-zinc-700">
                                  {money(r.pricePerUnit.shipShare)}
                                </span>
                              </div>
                              {r.shareOfDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-bold">
                                  <span>ส่วนลดสำหรับใบนี้</span>
                                  <span>-{money(r.shareOfDiscount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between pt-2 mt-2 border-t border-zinc-200/60 font-black text-zinc-900">
                                <div className="flex flex-col">
                                  <span>รวมสำหรับใบนี้</span>
                                  {r.shareOfDiscount > 0 && (
                                    <span className="text-[9px] text-emerald-500 font-medium">
                                      (หักส่วนลดแล้ว)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[color:var(--tint)]">
                                  {money(r.discountedLineSubtotal)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QR Payment Section */}
                  <div className="mx-auto text-center space-y-4">
                    <h3 className="text-sm font-bold text-slate-800">Scan QR Code to Pay</h3>
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-md">
                        <img
                          id="qrImage"
                          src="/Newqrcode.jpg"
                          alt="PromptPay QR Code"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = '/Newqrcode.jpg';
                        link.download = 'promptpay-qr-code.jpg';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="mx-auto block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md"
                    >
                      ดาวน์โหลด QR Code
                    </button>
                  </div>

                  {/* Evidence Uploads */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider px-1">
                      หลักฐานการชำระเงินและรูปผ้า
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label
                          className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${slip ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 bg-white hover:border-[color:var(--tint)]"}`}
                        >
                          {slip ? (
                            <>
                              {slipPreview && (
                                <img
                                  src={slipPreview}
                                  alt="Slip"
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity h-full w-full">
                                <span className="bg-white text-zinc-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                                  <Edit2 className="w-3 h-3" /> แก้ไข
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-2">
                              <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                              <span className="text-[11px] font-bold text-zinc-600 block">
                                สลิปโอนเงิน
                              </span>
                              <span className="text-[9px] text-rose-500 font-bold leading-none mt-1 inline-block">
                                * จำเป็น
                              </span>
                            </div>
                          )}
                          <input
                            ref={slipCamRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const err = checkImage(file);
                                if (err)
                                  return Swal.fire("ขออภัย", err, "error");
                                setSlip(file);
                                setSlipPreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => clickCamera(slipCamRef)}
                            className="flex-1 h-9 rounded-xl bg-zinc-100 text-[10px] font-bold text-zinc-600 active:scale-95 transition-all"
                          >
                            กล้อง
                          </button>
                          <button
                            type="button"
                            onClick={() => clickGallery(slipCamRef)}
                            className="flex-1 h-9 rounded-xl bg-zinc-100 text-[10px] font-bold text-zinc-600 active:scale-95 transition-all"
                          >
                            แกลเลอรี่
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${basketPhoto ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 bg-white hover:border-[color:var(--tint)]"}`}
                        >
                          {basketPhoto ? (
                            <>
                              {basketPreview && (
                                <img
                                  src={basketPreview}
                                  alt="Basket"
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity h-full w-full">
                                <span className="bg-white text-zinc-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                                  <Edit2 className="w-3 h-3" /> แก้ไข
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-2">
                              <ImageIcon className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                              <span className="text-[11px] font-bold text-zinc-600 block">
                                รูปถุง/ตะกร้า
                              </span>
                              <span className="text-[9px] text-rose-500 font-bold leading-none mt-1 inline-block">
                                * จำเป็น
                              </span>
                            </div>
                          )}
                          <input
                            ref={basketCamRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const err = checkImage(file);
                                if (err)
                                  return Swal.fire("ขออภัย", err, "error");
                                setBasketPhoto(file);
                                setBasketPreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => clickCamera(basketCamRef)}
                            className="flex-1 h-9 rounded-xl bg-zinc-100 text-[10px] font-bold text-zinc-600 active:scale-95 transition-all"
                          >
                            กล้อง
                          </button>
                          <button
                            type="button"
                            onClick={() => clickGallery(basketCamRef)}
                            className="flex-1 h-9 rounded-xl bg-zinc-100 text-[10px] font-bold text-zinc-600 active:scale-95 transition-all"
                          >
                            แกลเลอรี่
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Final Confirm Button Area */}
                  <div className="fixed left-0 right-0 bottom-[80px] bg-gradient-to-t from-white via-white/80 to-transparent px-4 pt-10 pb-4 z-40">
                    <div className="max-w-md mx-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(2);
                          window.scrollTo(0, 0);
                        }}
                        className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[color:var(--tint)] text-white active:scale-95 transition-all shadow-lg shadow-blue-100"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-500 font-medium tracking-tight">
                          ยอดชำระสุทธิ
                        </p>
                        <p className="text-base font-bold truncate">
                          {money(totals.grandTotal)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit || busy}
                        className={`h-11 rounded-2xl px-6 text-sm font-bold transition-all flex items-center gap-2 ${
                          canSubmit && !busy
                            ? "bg-[color:var(--tint)] text-white shadow active:scale-95"
                            : "bg-slate-100 text-slate-300 pointer-events-none"
                        }`}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>สั่งเลย</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </main>
      </div>
      <BottomNav />

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowTerms(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-slate-900 ml-1">เงื่อนไขการใช้บริการ</h3>
                <button 
                  onClick={() => setShowTerms(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
             </div>
             <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
                <section>
                    <h4 className="text-[15px] font-black text-slate-900 mb-2">1. การยอมรับเงื่อนไข</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">ผู้ใช้งานยอมรับว่าการสมัครใช้งานและการให้ข้อมูลส่วนบุคคลแก่ Masakdi มาซักดิ่ ถือว่าผู้ใช้งานได้อ่านและตกลงตามเงื่อนไขการใช้บริการและนโยบายความเป็นส่วนตัวที่กำหนดไว้ทั้งหมด</p>
                </section>
                <section>
                    <h4 className="text-[15px] font-black text-slate-900 mb-2">2. ข้อมูลที่ผู้ใช้งานให้ไว้</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">ผู้ใช้งานตกลงที่จะให้ข้อมูลที่เป็นจริง ถูกต้อง และครบถ้วน เพื่อให้ Masakdi มาซักดิ่ สามารถให้บริการได้อย่างเหมาะสม</p>
                </section>
                <section>
                    <h4 className="text-[15px] font-black text-slate-900 mb-2">3. การใช้ข้อมูล</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">Masakdi มาซักดิ่ จะใช้ข้อมูลเพื่อการยืนยันตัวตน การจัดส่งสิทธิประโยชน์ การพัฒนาบริการ และการติดต่อข่าวสารที่เกี่ยวข้องกับบริการ</p>
                </section>
                <section>
                    <h4 className="text-[15px] font-black text-slate-900 mb-2">4. ข้อจำกัดความรับผิดชอบ</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">Masakdi มาซักดิ่ จะไม่รับผิดชอบต่อความเสียหายจากข้อมูลที่ไม่ถูกต้องหรือไม่ครบถ้วนที่ผู้ใช้งานให้มา</p>
                </section>
             </div>
             <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowTerms(false)}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-200 active:scale-[0.98] transition-all">
                  รับทราบและปิด
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowPrivacy(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-slate-900 ml-1">นโยบายความเป็นส่วนตัว</h3>
                <button 
                  onClick={() => setShowPrivacy(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
             </div>
             <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6 text-left">
                <div className="space-y-4">
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">1. ผู้ควบคุมข้อมูลส่วนบุคคล</h4>
                        <p className="text-sm text-slate-600">Masakdi มาซักดิ่ เป็นผู้ควบคุมข้อมูลส่วนบุคคลตาม PDPA</p>
                    </section>
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">2. ข้อมูลส่วนบุคคลที่เก็บรวบรวม</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">เบอร์โทร อีเมล อาชีพ ที่อยู่ และประเภทที่อยู่</p>
                    </section>
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">3. วัตถุประสงค์ในการใช้ข้อมูล</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">ใช้เพื่อการสมัครใช้งาน ยืนยันตัวตน การพัฒนาบริการ และการทำการตลาดที่เหมาะสม</p>
                    </section>
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">4. การเปิดเผยข้อมูล</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">ข้อมูลจะไม่ถูกขายหรือเปิดเผยต่อบุคคลภายนอก ใช้เฉพาะภายใน Masakdi มาซักดิ่ เท่านั้น</p>
                    </section>
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">5. ระยะเวลาการจัดเก็บข้อมูล</h4>
                        <p className="text-sm text-slate-600">เก็บไว้ตามระยะเวลาที่จำเป็นและทำลายเมื่อหมดความจำเป็น</p>
                    </section>
                    <section>
                        <h4 className="text-[15px] font-black text-slate-900 mb-1">6. สิทธิของเจ้าของข้อมูล</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">ผู้ใช้งานมีสิทธิเข้าถึง แก้ไข ลบ ถอนความยินยอม และคัดค้านการประมวลผลได้</p>
                    </section>
                    <section className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">7. ช่องทางการติดต่อ</h4>
                        <p className="text-sm font-bold text-slate-900">Masakdi มาซักดิ่</p>
                        <p className="text-[13px] text-slate-600"><b>อีเมล:</b> masakdi.th@gmail.com</p>
                        <p className="text-[13px] text-slate-600"><b>โทร:</b> 064-084-0777</p>
                    </section>
                </div>
             </div>
             <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowPrivacy(false)}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-100 active:scale-[0.98] transition-all">
                  เข้าใจแล้ว
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
