"use client"
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supa } from "@/app/lib/supabaseClient";
import {
  ArrowLeft, Check, X, User, Crown, Clock, RefreshCw, Eye, Package, DollarSign, Search, Edit2, CheckCircle2, Clipboard, Phone
} from "lucide-react";
import Swal from "sweetalert2";

export default function AdminMembershipPage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"requests" | "members">("requests");
  
  // Requests State
  const [requests, setRequests] = useState<any[]>([]);
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "approved">("pending");
  const [requestSearch, setRequestSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Members State
  const [members, setMembers] = useState<any[]>([]);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      setAuthOk(true);
      loadRequests();
      loadMembers();
    } else {
      router.push("/Admins/Dispatch");
    }
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch("/api/admin/memberships", {
        headers: { "x-admin-token": token || "" }
      });
      const json = await res.json();
      if (json.data) setRequests(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (q = "") => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.data) setMembers(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleApprove = async (request: any) => {
    const { id, user_id, metadata } = request;
    const tier = metadata?.requested_tier || "member";

    const result = await Swal.fire({
      title: 'ยืนยันการอนุมัติ',
      text: `คุณต้องการอนุมัติระดับ ${tier.toUpperCase()} ให้กับผู้ใช้นี้ใช่หรือไม่?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'อนุมัติ',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/memberships/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, tier })
      });
      if (res.ok) {
        Swal.fire('สำเร็จ', 'อนุมัติสมาชิกเรียบร้อยแล้ว', 'success');
        loadRequests();
        loadMembers();
      } else {
        throw new Error('Failed to approve');
      }
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleEditMemberTier = async (member: any) => {
    const { value: tier } = await Swal.fire({
      title: 'แก้ไขระดับสมาชิก',
      input: 'select',
      inputOptions: {
        'verified_user': 'User (ผู้ใช้งานทั่วไป)',
        'member': 'Member',
        'silver': 'Silver',
        'gold': 'Gold'
      },
      inputValue: member.membership_tier,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก'
    });

    if (tier) {
      try {
        const isNowMember = tier !== 'verified_user';
        const res = await fetch(`/api/admin/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            membership_tier: tier,
            is_member: isNowMember,
            member_status: isNowMember ? 'approved' : 'none'
          })
        });

        if (res.ok) {
          Swal.fire('สำเร็จ', 'อัปเดตระดับสมาชิกแล้ว', 'success');
          loadMembers(searchQuery);
        } else {
          throw new Error('Update failed');
        }
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.message, 'error');
      }
    }
  };

  const handleEditFreeDelivery = async (member: any) => {
    const { value: count } = await Swal.fire({
      title: 'แก้ไขจำนวนส่งฟรี',
      input: 'number',
      inputLabel: 'จำนวนสิทธิ์การส่งฟรีที่เหลือ',
      inputValue: member.free_delivery_count || 0,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก'
    });

    if (count !== undefined && count !== null) {
      try {
        const res = await fetch(`/api/admin/members/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            free_delivery_count: parseInt(count)
          })
        });

        if (res.ok) {
          Swal.fire('สำเร็จ', 'อัปเดตจำนวนส่งฟรีแล้ว', 'success');
          loadMembers(searchQuery);
        } else {
          throw new Error('Update failed');
        }
      } catch (err: any) {
        Swal.fire('ผิดพลาด', err.message, 'error');
      }
    }
  };

  const handleResetAll = async () => {
    const result = await Swal.fire({
      title: 'รีเซ็ตระดับสมาชิกทั้งหมด?',
      text: 'การดำเนินการนี้จะปรับระดับสมาชิกทุกคนกลับเป็นระดับ User (ยังไม่เป็นสมาชิก) คุณแน่ใจหรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'รีเซ็ตทั้งหมด',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch("/api/admin/memberships/reset", { method: "POST" });
      if (res.ok) {
        Swal.fire('เรียบร้อย', 'รีเซ็ตระดับสมาชิกทั้งหมดแล้ว', 'success');
        loadMembers();
      }
    } catch (err: any) {
      Swal.fire('ผิดพลาด', err.message, 'error');
    }
  };

  if (!authOk) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 font-sans">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="px-5 py-4 flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-3 rounded-2xl bg-slate-50 text-slate-500 active:scale-95 transition-all border border-slate-100 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">จัดการสมาชิก</h1>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Membership Management</span>
            </div>
          </div>
        </div>

        {/* Premium Tabs */}
        <div className="flex px-4 bg-white/50 border-t border-slate-50">
          {[
            { id: "requests", label: "คำขอเข้าใหม่", sub: "Requests", icon: Clipboard },
            { id: "members", label: "รายชื่อสมาชิก", sub: "Member List", icon: User }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all relative ${
                tab === t.id ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <t.icon size={16} className={tab === t.id ? "text-blue-600" : "text-slate-300"} />
                <span className="text-sm font-black">{t.label}</span>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{t.sub}</span>
              {tab === t.id && (
                <div className="absolute bottom-0 left-6 right-6 h-1 bg-blue-600 rounded-t-full shadow-[0_-4px_10px_rgba(37,99,235,0.3)]" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {tab === "requests" ? (
          <>
            {/* Request Filters & Search */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "pending", label: "รอดำเนินการ", icon: Clock },
                  { id: "approved", label: "อนุมัติแล้ว", icon: CheckCircle2 },
                  { id: "all", label: "ทั้งหมด", icon: Clipboard }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setRequestFilter(f.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                      requestFilter === f.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "bg-white text-slate-400 border border-slate-100"
                    }`}
                  >
                    <f.icon size={14} />
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อ หรือเบอร์โทรในคำขอ..." 
                  className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center space-y-4">
                <RefreshCw size={40} className="mx-auto text-blue-200 animate-spin" />
                <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Loading Requests...</p>
              </div>
            ) : requests.filter(r => {
                const matchesFilter = requestFilter === "all" ? true : r.status === requestFilter;
                const searchLower = requestSearch.toLowerCase();
                const matchesSearch = (r.user?.nickname || "").toLowerCase().includes(searchLower) || 
                                     (r.user?.phone || "").includes(requestSearch);
                return matchesFilter && matchesSearch;
            }).length === 0 ? (
              <div className="py-24 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Clock className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-sm font-bold text-slate-400">ไม่พบรายการคำขอ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {requests
                  .filter(r => {
                    const matchesFilter = requestFilter === "all" ? true : r.status === requestFilter;
                    const searchLower = requestSearch.toLowerCase();
                    const matchesSearch = (r.user?.nickname || "").toLowerCase().includes(searchLower) || 
                                         (r.user?.phone || "").includes(requestSearch);
                    return matchesFilter && matchesSearch;
                  })
                  .map((req) => (
                  <div key={req.id} className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/40 border border-slate-50 space-y-5 hover:shadow-2xl transition-all group overflow-hidden relative">
                    {req.status === 'pending' && (
                       <div className="absolute top-0 right-0 py-1.5 px-4 bg-blue-600 text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-2xl">NEW</div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        <User size={32} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                          {req.user?.nickname || "ไม่ระบุชื่อ"}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock size={12} /> {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <a href={`tel:${req.user?.phone}`} className="p-3 bg-slate-50 text-slate-400 rounded-2xl active:scale-90 transition-all">
                        <Phone size={18} />
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50/50 rounded-3xl p-4 ring-1 ring-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">ระดับที่ขอ</p>
                        <p className="text-sm font-black text-blue-600 flex items-center gap-2">
                          <Crown size={18} className="text-blue-400" />
                          {req.metadata?.requested_tier?.toUpperCase() || "MEMBER"}
                        </p>
                      </div>
                      <div className="bg-slate-50/50 rounded-3xl p-4 ring-1 ring-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">ยอดโอน (Amount)</p>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <DollarSign size={18} className="text-slate-300" />
                          {req.amount}฿
                        </p>
                      </div>
                    </div>

                    {req.slip_url && (
                      <div className="rounded-[1.5rem] overflow-hidden border-2 border-slate-50 aspect-[4/3] relative group/slip cursor-pointer shadow-inner">
                        <img src={req.slip_url} alt="Slip" className="w-full h-full object-cover group-hover/slip:scale-110 transition-transform duration-500" />
                        <a 
                          href={req.slip_url} 
                          target="_blank" 
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/slip:opacity-100 transition-all flex items-center justify-center text-white text-xs font-black uppercase tracking-widest backdrop-blur-[2px]"
                        >
                          <Eye size={22} className="mb-2 block mx-auto" />
                          <span className="block mt-1">Full Image</span>
                        </a>
                      </div>
                    )}

                    {req.status === 'pending' && (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleApprove(req)}
                          disabled={busyId === req.id}
                          className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 transition-all"
                        >
                          <CheckCircle2 size={16} />
                          อนุมัติทิ้ง
                        </button>
                        <button className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center active:scale-[0.98] transition-all hover:bg-rose-50 hover:text-rose-500">
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {req.status === 'approved' && (
                       <div className="py-3 px-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">ดำเนินการเสร็จสิ้น</span>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "all", label: "ทั้งหมด", icon: Clipboard },
                  { id: "gold", label: "Gold", icon: Crown, color: "text-amber-500" },
                  { id: "silver", label: "Silver", icon: Crown, color: "text-slate-400" },
                  { id: "member", label: "Member", icon: Crown, color: "text-blue-500" },
                  { id: "verified_user", label: "Users", icon: User, color: "text-slate-300" }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTierFilter(f.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                      tierFilter === f.id 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "bg-white text-slate-400 border border-slate-100"
                    }`}
                  >
                    <f.icon size={14} className={tierFilter === f.id ? "text-white" : f.color} />
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative group flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input 
                    type="text" 
                    placeholder="ค้นหาชื่อเล่น หรือเบอร์โทรสมาชิก..." 
                    className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      loadMembers(e.target.value);
                    }}
                  />
                </div>
                <button 
                  onClick={() => loadMembers(searchQuery)}
                  className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors shadow-sm active:scale-95"
                >
                  <RefreshCw size={20} className={searching ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {searching && members.length === 0 ? (
              <div className="py-12 text-center text-slate-400">กำลังค้นหา...</div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                ไม่พบข้อมูลสมาชิก
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members
                  .filter(m => tierFilter === "all" ? true : m.membership_tier === tierFilter)
                  .map((member) => (
                  <div key={member.id} className="bg-white rounded-[2rem] p-5 shadow-xl shadow-slate-200/40 border border-slate-50 flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${
                        member.membership_tier === 'gold' ? 'bg-amber-100 text-amber-600 font-serif' :
                        member.membership_tier === 'silver' ? 'bg-slate-100 text-slate-400 font-serif' :
                        member.membership_tier === 'member' ? 'bg-blue-100 text-blue-600 font-serif' :
                        'bg-slate-50 text-slate-300'
                      }`}>
                        {member.membership_tier === 'gold' ? 'G' :
                         member.membership_tier === 'silver' ? 'S' :
                         member.membership_tier === 'member' ? 'M' : 'U'}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{member.nickname || "ไม่ระบุชื่อ"}</h3>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{member.phone || "-"}</p>
                        <div className="flex items-center gap-2 mt-2">
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-tighter ${
                              member.membership_tier === 'verified_user' ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'
                           }`}>
                              {member.membership_tier}
                           </span>
                           {member.membership_expires_at && (
                             <span className="text-[8px] font-bold text-slate-300 flex items-center gap-1">
                               <Clock size={10} />
                               {new Date(member.membership_expires_at).toLocaleDateString()}
                             </span>
                           )}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleEditFreeDelivery(member); }}
                             className="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-black flex items-center gap-1 hover:bg-emerald-100 border border-emerald-100"
                           >
                             <Package size={10} />
                             {member.free_delivery_count || 0} FREE
                           </button>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleEditMemberTier(member)}
                      className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
