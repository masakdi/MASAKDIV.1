"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import BottomNav from "@/app/components/BottomNav";
import { Ticket, Gift, AlertCircle, Copy, Check, CalendarClock, Lock, Crown } from "lucide-react";
import { getUserCoupons, collectCoupon, getUserTier, type Coupon } from "@/app/actions/coupon";
import Swal from "sweetalert2";

export default function UserCouponsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>("verified_user"); // New state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [inputCode, setInputCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // LIFF logic consistent with other pages
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_HOME!;
        await liff.init({ liffId });

        let currentUserId = null;

        if (!liff.isLoggedIn()) {
            const sessionUser = sessionStorage.getItem("user_id");
            if (sessionUser) {
                currentUserId = sessionUser;
            } else {
                await liff.login({ redirectUri: window.location.origin });
                return;
            }
        } else {
             // Logic to get user ID from LIFF usually involves API call or session
             // Assuming session is set or we use dummy for now if not fully implemented in snippet
             const sessionUser = sessionStorage.getItem("user_id");
             if(sessionUser) currentUserId = sessionUser;
        }

        if (currentUserId) {
           setUserId(currentUserId);
           // Parallel fetch
           const [cData, tier] = await Promise.all([
               getUserCoupons(currentUserId),
               getUserTier(currentUserId)
           ]);
           setCoupons(cData);
           setUserTier(tier);
        }
      } catch (err) {
        console.error("Error init:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadCoupons = async (uid: string) => {
      // Helper refresh
      const [cData, tier] = await Promise.all([
           getUserCoupons(uid),
           getUserTier(uid)
      ]);
      setCoupons(cData);
      setUserTier(tier);
  };

  const handleRedeem = async () => {
      if (!inputCode.trim() || !userId) return;
      setSubmitting(true);
      try {
          // Note: collectCoupon will now check roles too!
          const result = await collectCoupon(userId, inputCode);
          if (result.error) {
              Swal.fire({
                  icon: 'error',
                  title: 'ไม่สามารถเก็บคูปองได้',
                  text: result.error,
                  confirmButtonColor: '#1257FF'
              });
          } else {
              Swal.fire({
                  icon: 'success',
                  title: 'สำเร็จ!',
                  text: 'เก็บคูปองเรียบร้อยแล้ว',
                  confirmButtonColor: '#1257FF'
              });
              setInputCode("");
              loadCoupons(userId);
          }
      } catch (error) {
          console.error(error);
          Swal.fire('Error', 'เกิดข้อผิดพลาด', 'error');
      } finally {
          setSubmitting(false);
      }
  };

  const checkEligibility = (coupon: any) => {
      const allowed = coupon.allowed_roles || ['all'];
      if (allowed.includes('all')) return { eligible: true };
      if (allowed.includes(userTier)) return { eligible: true };
      return { eligible: false, required: allowed };
  };

  const handleCouponClick = (coupon: any) => {
      const { eligible } = checkEligibility(coupon);
      if (!eligible) {
          router.push("/Users/Membership");
      }
  };

  const money = (val: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    }).format(val);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-blue-600" />
            คูปองของฉัน
          </h1>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 ml-8">
            My Rewards & Coupons
          </p>
        </div>
        <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase text-slate-600">
                {userTier === 'verified_user' ? 'GUEST' : userTier}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
               <Gift className="w-5 h-5 text-blue-600" />
            </div>
        </div>
      </header>

      <main className="px-5 max-w-md mx-auto space-y-8 mt-4">
        
        {/* Redeem Box */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <label className="text-sm font-bold text-slate-700 mb-3 block ml-1">กรอกโค้ดส่วนลด</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="เช่น WELCOME"
                    className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-100 bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none uppercase font-mono tracking-wider text-slate-900 transition-all"
                />
                <button 
                    onClick={handleRedeem}
                    disabled={submitting || !inputCode}
                    className="px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                >
                    {submitting ? '...' : 'เก็บ'}
                </button>
            </div>
        </div>

        {/* Coupons List */}
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">คูปองที่มี ({coupons.length})</h2>
                {coupons.length > 0 && (
                   <div className="h-[1px] flex-1 bg-slate-200 mx-4"></div>
                )}
            </div>
            
            {coupons.length === 0 ? (
                <div className="text-center py-16 px-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50 opacity-80">
                    <Ticket className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">ยังไม่มีคูปองให้ใช้งานในขณะนี้</p>
                    <p className="text-[11px] text-slate-300 mt-1">ติดตามโปรโมชั่นใหม่ๆ ได้เร็วๆ นี้</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {coupons.map((coupon) => {
                        const { eligible, required } = checkEligibility(coupon);
                        const isForEveryone = (coupon.allowed_roles || ['all']).includes('all');

                        return (
                        <div 
                            key={coupon.user_coupon_id} 
                            onClick={() => handleCouponClick(coupon)}
                            className={`relative w-full h-32 flex drop-shadow-sm transition-transform active:scale-[0.99] group cursor-pointer ${
                                coupon.is_expired ? 'opacity-60 grayscale' : (!eligible ? 'opacity-90' : 'hover:-translate-y-1')
                            }`}
                        >
                            {/* Front Notch (Left Edge Center) */}
                            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-slate-50 rounded-full z-20 shadow-[inset_-2px_0_4px_rgba(0,0,0,0.05)]"></div>

                            {/* Left Section (Blue with Inverted Corners) */}
                            <div 
                                className={`flex-1 pl-8 pr-4 py-6 relative flex flex-col justify-between overflow-hidden text-white`}
                                style={{
                                    backgroundImage: !eligible
                                        ? `radial-gradient(circle at 0 0, transparent 12px, #334155 12.5px), radial-gradient(circle at 0 100%, transparent 12px, #334155 12.5px)`
                                        : coupon.is_expired 
                                            ? `radial-gradient(circle at 0 0, transparent 12px, #64748b 12.5px), radial-gradient(circle at 0 100%, transparent 12px, #64748b 12.5px)`
                                            : `radial-gradient(circle at 0 0, transparent 12px, #2563EB 12.5px), radial-gradient(circle at 0 100%, transparent 12px, #2563EB 12.5px)`,
                                    backgroundPosition: 'top left, bottom left',
                                    backgroundSize: '100% 51%',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            >
                                {/* Top: Title/Description */}
                                <div className="z-10 flex items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white/90 text-xs font-bold uppercase tracking-wider">
                                                {coupon.description || 'VOUCHER'}
                                            </h3>
                                            {!eligible && (
                                                <span className="px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-black rounded uppercase flex items-center gap-1">
                                                    <Crown size={8} /> Exclusive
                                                </span>
                                            )}
                                            {isForEveryone && eligible && (
                                                <span className="px-1.5 py-0.5 bg-white/20 text-white text-[9px] font-bold rounded uppercase">
                                                    Everyone
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <h2 className="text-4xl font-black tracking-tighter leading-none">
                                                {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : money(coupon.discount_value).replace('฿', '')}
                                            </h2>
                                            <span className="text-lg font-bold text-white/80">OFF</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Expiry */}
                                <div className="z-10 flex items-center gap-2 text-white/70">
                                    <CalendarClock className="w-3.5 h-3.5" />
                                    <p className="text-[10px] font-medium tracking-wide">
                                        Valid until: {coupon.end_date ? new Date(coupon.end_date).toLocaleDateString('en-GB') : 'No Expiry'}
                                    </p>
                                </div>
                            </div>

                            {/* Divider Area & Notches */}
                            <div className="relative w-0 flex flex-col items-center">
                                {/* Top Notch */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[45%] w-5 h-5 bg-slate-50 rounded-full z-20 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)]"></div>
                                
                                {/* Dashed Line */}
                                <div className="h-full border-l-[3px] border-dotted border-white/40 absolute left-1/2 -translate-x-1/2 z-30"></div>
                                <div className="h-full border-l-[3px] border-dotted border-slate-200 absolute left-1/2 -translate-x-1/2 z-10"></div>

                                {/* Bottom Notch */}
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[45%] w-5 h-5 bg-slate-50 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]"></div>
                            </div>

                            {/* Right Section (White with Inverted Corners) */}
                            <div 
                                className="w-32 p-2 flex flex-col items-center justify-center gap-2 border-r border-slate-100 relative text-slate-800"
                                style={{
                                    backgroundImage: `radial-gradient(circle at 100% 0, transparent 12px, #ffffff 12.5px), radial-gradient(circle at 100% 100%, transparent 12px, #ffffff 12.5px)`,
                                    backgroundPosition: 'top right, bottom right',
                                    backgroundSize: '100% 51%',
                                    backgroundRepeat: 'no-repeat'
                                }}
                            >
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {eligible ? 'CODE' : 'LOCKED'}
                                </span>
                                
                                <div className={`w-full py-1.5 px-2 bg-slate-50 rounded border border-slate-100 text-center ${coupon.is_expired ? 'opacity-50' : ''}`}>
                                    {eligible ? (
                                        <div className={`font-mono font-black text-sm tracking-tight truncate ${coupon.is_expired ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                            {coupon.code}
                                        </div>
                                    ) : (
                                        <div className="flex justify-center items-center gap-1 text-slate-400">
                                            <Lock size={14} /> 
                                            <span className="text-[10px] font-bold">Unlock</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                  })}
                </div>
            )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
