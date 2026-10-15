"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import Swal from "sweetalert2";
import { getShopStatus } from "@/app/lib/shopHours";

/* ===== ตั้งเวลาเปิด-ปิดรับออเดอร์ (ใช้ในหน้า Dispatch > บริการ และ BookingConfig) ===== */
export default function ShopHoursEditor() {
  const [hours, setHours] = useState({ open_time: "09:00", close_time: "18:00", cutoff_minutes: 15 });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/shop-hours", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.hours) {
          setHours({
            open_time: String(d.hours.open_time).slice(0, 5),
            close_time: String(d.hours.close_time).slice(0, 5),
            cutoff_minutes: Number(d.hours.cutoff_minutes),
          });
        }
      })
      .catch((e) => console.error("Failed to load shop hours", e))
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/shop-hours", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": sessionStorage.getItem("admin_token") || "",
        },
        body: JSON.stringify(hours),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      Swal.fire({ title: "สำเร็จ", text: "บันทึกเวลาเปิด-ปิดเรียบร้อย", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire("Error", error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ตัวอย่างสถานะตามค่าที่กรอก (ยังไม่บันทึกก็เห็นผล)
  const preview = getShopStatus(hours);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4" /> เวลาเปิด-ปิดรับออเดอร์
          </h2>
          <p className="text-xs text-slate-500 mt-1">นอกเวลานี้ลูกค้าสั่งด่วนไม่ได้ (จองล่วงหน้าได้ตลอด) · เวลาไทย</p>
        </div>
        {loaded && (
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              preview.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
            }`}
          >
            {preview.isOpen ? "ตอนนี้เปิดรับ" : "ตอนนี้ปิดรับ"}
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-slate-500 space-y-1">
            <span>เปิด</span>
            <input
              type="time"
              value={hours.open_time}
              onChange={(e) => setHours({ ...hours, open_time: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500 space-y-1">
            <span>ปิด</span>
            <input
              type="time"
              value={hours.close_time}
              onChange={(e) => setHours({ ...hours, close_time: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500 space-y-1">
            <span>ปิดรับก่อน (นาที)</span>
            <input
              type="number"
              min={0}
              max={180}
              value={hours.cutoff_minutes}
              onChange={(e) => setHours({ ...hours, cutoff_minutes: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
        <p className="text-xs text-slate-600">
          ลูกค้าสั่งด่วนได้ <b>{preview.openLabel} - {preview.lastOrderLabel} น.</b> (ร้านปิด {preview.closeLabel} น.)
        </p>
        <button
          onClick={save}
          disabled={saving || !loaded}
          className="w-full py-3 text-white rounded-2xl text-sm font-medium bg-gradient-to-r from-[#1257FF] to-[#3A7BFF] disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกเวลา"}
        </button>
      </div>
    </div>
  );
}
