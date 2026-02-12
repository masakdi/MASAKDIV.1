"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBookingConfigs, toggleBookingDay, type BookingConfig } from "@/app/actions/booking";
import { Calendar, Check, X, ShieldCheck, Clock, Settings2, ArrowLeft } from "lucide-react";
import Swal from "sweetalert2";

const MASAKDI_BLUE = "#1257FF";
const BLUE_GRADIENT_FROM = "from-[#1257FF]";
const BLUE_GRADIENT_TO = "to-[#3A7BFF]";

const DAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export default function BookingConfigPage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [password, setPassword] = useState("");
  const [configs, setConfigs] = useState<BookingConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (token) checkPass(token);
  }, []);

  const checkPass = async (inputPass: string = password) => {
    try {
      const resp = await fetch("/api/admin/ping", {
        headers: { "x-admin-token": inputPass },
      });
      if (resp.ok) {
        sessionStorage.setItem("admin_token", inputPass);
        setAuthOk(true);
        fetchConfigs();
      } else if (inputPass === password) {
        alert("รหัสผ่านไม่ถูกต้อง");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await getBookingConfigs();
      setConfigs(data);
    } catch (error) {
      console.error("Failed to load configs", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (dayOfWeek: number, currentActive: boolean) => {
    try {
      await toggleBookingDay(dayOfWeek, !currentActive);
      fetchConfigs();
      Swal.fire({
        title: "สำเร็จ",
        text: `อัปเดตวัน${DAYS_TH[dayOfWeek]}เรียบร้อย`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
       Swal.fire("Error", "ไม่สามารถอัปเดตได้", "error");
    }
  };

  if (!authOk)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-blue-50">
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold mb-2">ตั้งค่าระบบจองล่วงหน้า</h1>
          <p className="text-sm text-slate-500 mb-6">กรุณาระบุรหัสผ่านเพื่อเข้าใช้งาน</p>
          <input
            type="password"
            placeholder="รหัสผ่านผู้ดูแล"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 mb-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkPass()}
          />
          <button
            onClick={() => checkPass()}
            className={`w-full py-3 text-white rounded-2xl font-medium shadow-lg bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO}`}
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <button 
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">จัดการวันจองล่วงหน้า</h1>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto mt-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
               <Settings2 className="w-4 h-4" /> เลือกวันที่อนุญาตให้ลูกค้าจอง
            </h2>
            <p className="text-xs text-slate-500 mt-1">วันที่เปิดใช้งานจะปรากฏให้ลูกค้าเลือกในหน้าสั่งซื้อ</p>
          </div>

          <div className="divide-y divide-slate-100">
            {DAYS_TH.map((dayName, index) => {
              const config = configs.find(c => c.day_of_week === index);
              const isActive = config?.is_active || false;

              return (
                <div key={index} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isActive ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400"
                    }`}>
                      {dayName[0]}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                        วัน{dayName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {isActive ? "เปิดรับจองอยู่" : "ปิดรับจอง"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(index, isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        isActive ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-3xl">
           <div className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-blue-900">คำแนะนำ</h3>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                   การเปิดวันจองจะทำให้ลูกค้าในระบบสามารถเลือกวันที่คุณกำหนดในการจองคิวซักผ้าล่วงหน้าได้ 
                   หากวันไหนงานเยอะ แนะนำให้ปิดชั่วคราวเพื่อป้องกันคิวล้นครับ
                </p>
              </div>
           </div>
        </div>

        {loading && (
          <div className="text-center py-10 text-slate-400 text-sm animate-pulse">
            กำลังโหลดข้อมูล...
          </div>
        )}
      </main>
    </div>
  );
}
