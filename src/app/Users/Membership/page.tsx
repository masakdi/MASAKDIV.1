"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import BottomNav from "@/app/components/BottomNav";
import { Crown, Star, Gift, TrendingUp, MapPin, Camera, ImageIcon, Clock, Check, User, Phone, Calendar, Link as LinkIcon } from "lucide-react";
import Swal from "sweetalert2";

type MembershipData = {
  user: {
    membership_tier: string;
    completed_orders_count: number;
    membership_started_at?: string;
    membership_expires_at?: string;
    last_activity_at?: string;
    last_rank_reset_at?: string;
    created_at?: string;
    nickname?: string;
    phone?: string;
  };
  points: {
    total_points: number;
    available_points: number;
    used_points: number;
  };
  tier: {
    tier_name: string;
    display_name: string;
    min_orders: number;
    subscription_price: number;
    discount_percent: number;
  };
  server_time?: string;
};

export default function MembershipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [membershipData, setMembershipData] = useState<MembershipData | null>(null);
  const [busy, setBusy] = useState(false);
  const purchaseRef = useRef<HTMLDivElement>(null);

  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);

  // Profile fields (Source of truth)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [googleMapLink, setGoogleMapLink] = useState("");

  const buyTiers = [
    { name: "member", display: "Member", price: 99, color: "bg-blue-50 border-blue-200 text-blue-700", desc: "ส่งฟรี 1 ครั้ง/เดือน, ส่วนลดค่าซัก 15%" },
    { name: "silver", display: "Silver", price: 199, color: "bg-slate-100 border-slate-300 text-slate-700", desc: "ส่งฟรี 2 ครั้ง/เดือน, ส่วนลดค่าซัก 15%" },
    { name: "gold", display: "Gold", price: 299, color: "bg-yellow-50 border-yellow-200 text-yellow-700", desc: "ส่งฟรี 3 ครั้ง/เดือน, ส่วนลดค่าซัก 20%, สั่งนอกรอบได้" },
  ];

  useEffect(() => {
    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_HOME!;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          await liff.login({ redirectUri: window.location.origin });
          return;
        }

        const userId = sessionStorage.getItem("user_id");
        if (!userId) {
          console.error("No user_id found");
          setLoading(false);
          return;
        }

        // Fetch membership data
        const res = await fetch(`/api/membership?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setMembershipData(data);
          // Set initial values from source of truth
          if (data.user?.full_name) {
            const parts = data.user.full_name.split(" ");
            setFirstName(parts[0] || "");
            setLastName(parts.slice(1).join(" ") || "");
          }
          setNickname(data.user?.nickname || "");
          setPhone(data.user?.phone || "");
          setGender(data.user?.gender || "");
          setBirthDate(data.user?.birth_date || "");
          setContactAddress(data.user?.contact_address || "");
          setGoogleMapLink(data.user?.google_map_link || "");
        }
      } catch (err) {
        console.error("Error loading membership:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handlePurchase = async () => {
    if (!selectedTier || !slip) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณาเลือกประเภทสมาชิกและแนบสลิป", "warning");
      return;
    }

    if (!firstName || !lastName || !nickname || !phone || !gender || !birthDate || !contactAddress) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วนก่อนสมัคร", "warning");
      return;
    }

    setBusy(true);
    try {
      const { supa, BUCKET_SLIPS } = await import("@/app/lib/supabaseClient");
      const ext = slip.name.split(".").pop() || "jpg";
      const path = `membership-purchase/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { data: uploadData, error: uploadError } = await supa.storage.from(BUCKET_SLIPS).upload(path, slip);
      if (uploadError) throw uploadError;
      
      const slipUrl = supa.storage.from(BUCKET_SLIPS).getPublicUrl(uploadData.path).data.publicUrl;
      const userId = sessionStorage.getItem("user_id");

      const res = await fetch("/api/membership/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          tier: selectedTier,
          slip_url: slipUrl,
          amount: buyTiers.find(t => t.name === selectedTier)?.price || 0,
          first_name: firstName,
          last_name: lastName,
          nickname,
          phone,
          gender,
          birth_date: birthDate,
          contact_address: contactAddress,
          google_map_link: googleMapLink
        })
      });

      if (!res.ok) throw new Error("ส่งข้อมูลไม่สำเร็จ");

      await Swal.fire("สำเร็จ 🎉", "ส่งคำขอซื้อสมาชิกแล้ว รอ Admin ตรวจสอบ", "success");
      window.location.reload();
    } catch (e: any) {
      Swal.fire("ข้อผิดพลาด", e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "gold":
        return "🥇";
      case "silver":
        return "🥈";
      case "member":
        return "🎖️";
      default:
        return "👤";
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "gold":
        return "from-yellow-400 to-orange-500";
      case "silver":
        return "from-gray-300 to-gray-500";
      case "member":
        return "from-blue-400 to-indigo-500";
      default:
        return "from-slate-400 to-slate-600";
    }
  };

  const [timeToRankReset, setTimeToRankReset] = useState<string>("");
  const [timeToPointsReset, setTimeToPointsReset] = useState<string>("");

  useEffect(() => {
    if (!membershipData) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      // Calculate Rank Reset
      const rankRef = membershipData.user.last_rank_reset_at || membershipData.user.membership_started_at || membershipData.user.created_at;
      if (rankRef) {
        // PRODUCTION: 30 days
        const target = new Date(rankRef).getTime() + (30 * 24 * 60 * 60 * 1000);
        const diff = target - now;
        if (diff > 0) {
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const mins = Math.floor((diff % (60 * 60 * 1000)) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);

          if (days > 0) setTimeToRankReset(`${days}วัน ${hours}ชม`);
          else if (hours > 0) setTimeToRankReset(`${hours}ชม ${mins}ม`);
          else setTimeToRankReset(`${mins}ม ${secs}ว`);
        } else {
          setTimeToRankReset("หมดเวลา (กรุณารีเฟรช)");
        }
      }

      // Calculate Points Reset
      const activityRef = membershipData.user.last_activity_at || membershipData.user.created_at;
      if (activityRef) {
        // PRODUCTION: 90 days
        const target = new Date(activityRef).getTime() + (90 * 24 * 60 * 60 * 1000);
        const diff = target - now;
        if (diff > 0) {
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const mins = Math.floor((diff % (60 * 60 * 1000)) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);

          if (days > 0) setTimeToPointsReset(`${days}วัน ${hours}ชม`);
          else if (hours > 0) setTimeToPointsReset(`${hours}ชม ${mins}ม`);
          else setTimeToPointsReset(`${mins}ม ${secs}ว`);
        } else {
          setTimeToPointsReset("หมดเวลา (กรุณารีเฟรช)");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [membershipData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500" />
          <p className="text-sm text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!membershipData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600">ไม่พบข้อมูลสมาชิก</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const { user, points, tier } = membershipData;
  const tierName = tier.tier_name || "verified_user";
  const displayName = (tierName === "verified_user" || tier.display_name === "Verified User") ? "User" : (tier.display_name || "User");

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-5 py-4">
          <h1 className="text-lg font-semibold text-slate-900">สมาชิก</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* Membership Card */}
        <div
          className={`bg-gradient-to-br ${getTierColor(
            tierName
          )} rounded-3xl p-6 text-white shadow-xl`}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-4xl mb-2">{getTierIcon(tierName)}</div>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <p className="text-white text-sm mt-1">
                สมาชิกตั้งแต่ {user.membership_started_at ? new Date(user.membership_started_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
              </p>
              {user.membership_expires_at && (
                <p className="text-white font-medium text-sm mt-1 flex items-center gap-1">
                  <Clock size={14} className="animate-pulse" />
                  หมดอายุวันที่ {new Date(user.membership_expires_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {tierName !== "verified_user" && (
                <div className="mt-2 inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-inner">
                   <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                   <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider">
                     Reset Rank in: <span className="text-white">{timeToRankReset || "--ม --ว"}</span>
                   </p>
                </div>
              )}
            </div>
            <Crown size={32} className="text-white/60" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <p className="text-white text-xs mb-1">ออเดอร์ทั้งหมด</p>
              <p className="text-2xl font-bold">{user.completed_orders_count}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <p className="text-white text-xs mb-1">แต้มสะสม</p>
              <p className="text-2xl font-bold">{points.available_points}</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="text-yellow-500 fill-yellow-500" size={20} />
            สิทธิประโยชน์
          </h3>

          <div className="space-y-3">
            {tierName !== "verified_user" && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-200">
                    <Check size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">ส่งฟรีประจำเดือน</p>
                    <p className="text-sm text-slate-900">
                      {tierName === "member" ? "1 ครั้ง/เดือน" : tierName === "silver" ? "2 ครั้ง/เดือน" : "3 ครั้ง/เดือน"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-200">
                    <Check size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">ส่วนลดค่าซัก</p>
                    <p className="text-sm text-slate-900">
                      {tierName === "gold" ? "ส่วนลด 20%" : "ส่วนลด 15%"} สำหรับ 2 ออเดอร์ขึ้นไป
                    </p>
                  </div>
                </div>

                {(tierName === "silver" || tierName === "gold") && (
                  <div className="flex items-start gap-3">
                  
                  </div>
                )}

                {tierName === "gold" && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-200">
                        <Check size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">สิทธิ์สั่งนอกรอบ (จ-ศ)</p>
                        <p className="text-sm text-slate-900">เรียกใช้บริการนอกเวลาปกติได้ (จ่ายตามจริง)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                     
                     
                    </div>
                  </>
                )}
              </div>
            )}

            {tierName === "verified_user" && (
              <div className="text-center py-4">
                <p className="text-slate-500 mb-4">คุณยังไม่ได้เป็นสมาชิก</p>
                <button 
                  onClick={() => {
                    purchaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow active:scale-95"
                >
                  สมัครสมาชิก
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Points History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Gift className="text-pink-500" size={20} />
            แต้มสะสม
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{points.total_points}</p>
              <p className="text-xs text-slate-900 mt-1">แต้มทั้งหมด</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{points.available_points}</p>
              <p className="text-xs text-slate-900 mt-1">แต้มคงเหลือ</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-400">{points.used_points}</p>
              <p className="text-xs text-slate-900 mt-1">แต้มที่ใช้</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4">
            <p className="text-sm text-slate-700">
              💡 <b>เคล็ดลับ:</b> ทุกออเดอร์ที่สำเร็จจะได้รับ 1 แต้ม สามารถนำไปแลกของรางวัลได้ในอนาคต!
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Clock size={16} className="text-rose-500" />
                   <p className="text-xs font-bold text-slate-600 uppercase tracking-tight">แต้มจะหมดอายุภายใน</p>
                </div>
                <p className="text-sm font-black text-rose-600 tabular-nums bg-rose-50 px-3 py-1 rounded-lg border border-rose-100">
                   {timeToPointsReset || "--ม --ว"}
                </p>
             </div>
             <p className="text-[10px] text-slate-400 mt-2 italic">* แต้มจะถูกรีเซ็ตหากไม่มีการสั่งซื้อสินค้าใหม่ภายในระยะเวลาที่กำหนด</p>
          </div>
        </div>



        {/* Purchase Subscription Section */}
        {tierName !== "gold" && (
          <div ref={purchaseRef} className="bg-white rounded-2xl p-6 shadow-sm space-y-6 scroll-mt-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Crown className="text-yellow-500" size={20} />
              อัปเกรดระดับสมาชิก
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {buyTiers.filter(t => {
                const tierWeights: Record<string, number> = { "verified_user": 0, "member": 1, "silver": 2, "gold": 3 };
                return tierWeights[t.name] > tierWeights[tierName];
              }).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setSelectedTier(t.name);
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedTier === t.name
                      ? "border-blue-500 bg-blue-50/50"
                      : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${t.color}`}>
                      {t.display}
                    </span>
                    <span className="font-black text-slate-900">{t.price}฿</span>
                  </div>
                  <p className="text-xs text-slate-900 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>

            {selectedTier && (
              <div className="space-y-6 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Scan QR เพื่อชำระเงิน {buyTiers.find(t => t.name === selectedTier)?.price} บาท</p>
                  <div className="inline-block p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <img
                      src="/promptpay-qr.png"
                      alt="PromptPay"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <p className="text-sm font-bold text-slate-900 border-l-4 border-blue-500 pl-3 leading-none">กรุณากรอกข้อมูลส่วนตัวเพื่อสมัคร</p>
                  
                  <div className="space-y-6 pt-2">
                    {/* ข้อมูลส่วนตัว */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <User size={18} />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">ข้อมูลส่วนตัว</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 ml-1">ชื่อจริง</label>
                          <input 
                            type="text" 
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="กรอกชื่อจริง"
                            className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 ml-1">นามสกุล</label>
                          <input 
                            type="text" 
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="กรอกนามสกุล"
                            className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 ml-1">ชื่อเล่น</label>
                        <input 
                          type="text" 
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder="ระบุชื่อเล่นของคุณ"
                          className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 ml-1">เพศ</label>
                          <select 
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium"
                          >
                            <option value="">เลือกเพศ</option>
                            <option value="male">ชาย</option>
                            <option value="female">หญิง</option>
                            <option value="other">อื่นๆ</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 ml-1">วันเกิด</label>
                          <input 
                            type="date" 
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ข้อมูลการติดต่อ */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-rose-500 mb-1">
                        <Phone size={18} />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">ข้อมูลการติดต่อ</h4>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 ml-1">เบอร์โทรศัพท์</label>
                        <input 
                          type="tel" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0XX-XXX-XXXX"
                          className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    {/* ที่อยู่ */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-500 mb-1">
                        <MapPin size={18} />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800">ที่อยู่จัดส่ง / รับผ้า</h4>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 ml-1">ที่อยู่อย่างละเอียด</label>
                        <textarea 
                          value={contactAddress}
                          onChange={(e) => setContactAddress(e.target.value)}
                          placeholder="บ้านเลขที่, ชื่อหมู่บ้าน/คอนโด, ซอย, ถนน..."
                          rows={3}
                          className="w-full rounded-2xl px-4 py-3 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-slate-900 font-medium placeholder:text-slate-400"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 ml-1 flex items-center gap-1">
                          <LinkIcon size={12} className="text-blue-500" /> Google Map Link (ถ้ามี)
                        </label>
                        <input 
                          type="url" 
                          value={googleMapLink}
                          onChange={(e) => setGoogleMapLink(e.target.value)}
                          placeholder="https://maps.google.com/..."
                          className="w-full h-12 rounded-2xl px-4 text-sm bg-slate-50 border border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700">แนบสลิปการโอนเงิน</label>
                  {slip ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group">
                      {slipPreview && <img src={slipPreview} alt="Slip" className="w-full h-auto" />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => { setSlip(null); setSlipPreview(null); }}
                          className="bg-white text-rose-500 px-4 py-2 rounded-xl font-bold text-sm shadow-lg"
                        >
                          ลบรูปและเลือกใหม่
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSlip(file);
                              setSlipPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        <div className="h-24 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all">
                          <Camera size={24} className="mb-1" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">ถ่ายรูปสลิป</span>
                        </div>
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSlip(file);
                              setSlipPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        <div className="h-24 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all">
                          <ImageIcon size={24} className="mb-1" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">เลือกจากเครื่อง</span>
                        </div>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={busy || !slip}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 disabled:grayscale transition-all active:scale-[0.98]"
                  >
                    {busy ? "กำลังส่งข้อมูล..." : `ยืนยันการซื้อแพ็กเกจ ${buyTiers.find(t => t.name === selectedTier)?.display}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
