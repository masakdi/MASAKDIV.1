"use client";
import { useState, useEffect, useCallback, useMemo, ChangeEvent } from "react";
import { supa as supabase, BUCKET_REPORTS } from "@/app/lib/supabaseClient";
import {
  Package,
  CreditCard,
  AlertCircle,
  Smartphone,
  Image as ImageIcon,
  X,
} from "lucide-react";

// === Helper functions ===
const normalizePhone = (s: string): string =>
  (s || "").replace(/\D+/g, "").slice(0, 10);

const formatPhoneDisplay = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 10);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
};

// === Resize image before upload ===
async function resizeImage(
  file: File,
  {
    maxWidth = 1280,
    maxHeight = 1280,
    type = "image/jpeg",
    quality = 0.8,
  }: { maxWidth?: number; maxHeight?: number; type?: string; quality?: number } = {}
): Promise<File> {
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    i.src = url;
  });

  const { width, height } = img;
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  const targetW = Math.round(width * ratio);
  const targetH = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
  if (!blob) throw new Error("Failed to create blob from canvas");

  const ext = type.split("/")[1] || "jpg";
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}_resized.${ext}`, { type });
}

// === Main Component ===
export default function ReportPage() {
  const [step, setStep] = useState<number>(1);
  const [toast, setToast] = useState<{ msg: string; type: "info" | "error" | "success" } | null>(null);
  const [category, setCategory] = useState<string>("");
  const [detail, setDetail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const showToast = useCallback((msg: string, type: "info" | "error" | "success" = "info") => {
    setToast({ msg, type });
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handlePhoneChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setPhone(formatPhoneDisplay(e.target.value)),
    []
  );

  const canGoToStep2 = useMemo(() => !!category, [category]);
  const canGoToStep3 = useMemo(() => detail.trim().length >= 10, [detail]);
  const canSubmit = useMemo(
    () => normalizePhone(phone).length === 10 && consent && !sending,
    [phone, consent, sending]
  );

  const onPickFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files || []);
      if (!list.length) return;

      const picked = list[0];
      if (!picked.type.startsWith("image/")) {
        showToast("กรุณาเลือกเป็นไฟล์รูปภาพเท่านั้น", "error");
        e.target.value = "";
        return;
      }
      if (picked.size > 5 * 1024 * 1024) {
        showToast("ไฟล์รูปต้องไม่เกิน 5MB", "error");
        e.target.value = "";
        return;
      }

      const newPreview = URL.createObjectURL(picked);
      previews.forEach((url) => URL.revokeObjectURL(url));
      setFiles([picked]);
      setPreviews([newPreview]);
      e.target.value = "";
    },
    [previews, showToast]
  );

  const removeFile = useCallback(() => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
  }, [previews]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const normalizedPhone = normalizePhone(phone);
    if (!category) return showToast("กรุณาเลือกหมวดหมู่", "error");
    if (!detail.trim()) return showToast("กรุณากรอกรายละเอียด", "error");
    if (normalizedPhone.length !== 10) return showToast("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก", "error");
    if (!consent) return showToast("กรุณายินยอมเงื่อนไข", "error");

    setSending(true);
    try {
      let image_urls: string[] = [];

      if (files.length > 0) {
        const resized = await resizeImage(files[0]);
        const fileName = `${Date.now()}_${files[0].name}`;
        const { error } = await supabase.storage
          .from("uploads-reports")
          .upload(fileName, resized, { contentType: resized.type });

        if (error) {
          showToast("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่", "error");
          return;
        } else {
          const { data: publicUrl } = supabase.storage.from("uploads-reports").getPublicUrl(fileName);
          image_urls = [publicUrl.publicUrl];
        }
      }

      const allowedCats = ["delivery", "payment", "quality", "system"];
      const safeCategory = allowedCats.includes(category) ? category : "system";

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            category: safeCategory,
            detail: detail.trim(),
            contact_phone: normalizedPhone,
            image_urls,
          },
          consent: {
            agreed: true,
            at: new Date().toISOString(),
            version: "1.0",
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        showToast(json?.message || "ส่งข้อมูลไม่สำเร็จ", "error");
        return;
      }

      showToast("ส่งแบบฟอร์มเรียบร้อย", "success");
      setStep(1);
      setCategory("");
      setDetail("");
      setPhone("");
      setConsent(false);
      removeFile();
    } catch {
      showToast("เกิดข้อผิดพลาดในการส่งข้อมูล", "error");
    } finally {
      setSending(false);
    }
  }, [canSubmit, category, detail, phone, consent, files, showToast, removeFile]);

  return (
    <div
      className="min-h-[100dvh] bg-white text-slate-900 [--tint:#0A84FF]"
      style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {/* Overlay ตอนกำลังส่ง */}
      {sending && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-[999]">
          <p className="text-slate-600 text-sm animate-pulse">กำลังส่งข้อมูล...</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-3 z-[60] px-5" role="status" aria-live="polite">
          <div
            className={`mx-auto max-w-md rounded-2xl border px-4 py-3 text-sm shadow ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : toast.type === "error"
                ? "bg-rose-50 text-rose-900 border-rose-200"
                : "bg-slate-100 text-slate-800 border-slate-200"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto min-h-[100dvh] flex flex-col">
        <header className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200/60">
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h1 className="text-base font-medium text-slate-900">แจ้งปัญหา</h1>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-2 w-2 rounded-full ${
                    s <= step ? "bg-[color:var(--tint)]" : "bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-900">เลือกหมวดหมู่ปัญหา</h2>
              <div className="flex flex-wrap justify-between">
                {[
                  { id: "delivery", label: "การจัดส่ง", icon: Package },
                  { id: "payment", label: "การชำระเงิน", icon: CreditCard },
                  { id: "quality", label: "คุณภาพงานบริการ", icon: AlertCircle },
                  { id: "system", label: "การใช้งานระบบ", icon: Smartphone },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isActive = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      aria-pressed={isActive}
                      className={`w-[48%] mb-3 p-4 rounded-2xl min-h-[72px] ring-1 transition-all ${
                        isActive
                          ? "bg-[color:var(--tint)]/10 ring-[color:var(--tint)]"
                          : "bg-slate-50 ring-slate-200/60 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <Icon
                          size={24}
                          className={isActive ? "text-[color:var(--tint)]" : "text-slate-600"}
                        />
                        <span className="text-sm">{cat.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-medium text-slate-900 mb-2">รายละเอียดปัญหา</h2>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={6}
                  placeholder="โปรดอธิบายเหตุการณ์ สถานที่ เวลา และผลกระทบโดยย่อ"
                  className="w-full rounded-2xl bg-white p-3 text-[15px] resize-none ring-1 ring-slate-200/60 focus:outline-none focus:ring-[color:var(--tint)]/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">อัปโหลดรูป (ไม่บังคับ)</label>
                <label className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 cursor-pointer hover:bg-slate-200">
                  <ImageIcon size={18} />
                  <span className="text-sm">เลือกไฟล์</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onPickFiles} />
                </label>

                {previews.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {previews.map((src, i) => (
                      <div
                        key={i}
                        className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100"
                      >
                        <img src={src} alt="" className="w-full h-full object-contain" loading="lazy" />
                        <button
                          type="button"
                          onClick={removeFile}
                          className="absolute top-2 right-2 rounded-full bg-white/90 shadow-md p-1.5 hover:bg-white"
                          aria-label="ลบรูป"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-sm font-medium text-slate-900">ข้อมูลสำหรับติดต่อกลับ</h2>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="0XX-XXX-XXXX"
                inputMode="tel"
                autoComplete="tel"
                maxLength={12}
                className="w-full h-11 rounded-xl px-4 text-[15px] bg-white ring-1 ring-slate-200/60 focus:outline-none focus:ring-[color:var(--tint)]/40"
              />
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 flex-shrink-0"
                />
                <span>ยินยอมให้ใช้ข้อมูลเพื่อการติดต่อกลับเกี่ยวกับเรื่องที่แจ้ง</span>
              </label>
            </div>
          )}
        </main>

        <footer
          className="sticky bottom-0 bg-white/90 backdrop-blur px-5 py-4 z-[70]"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
        >
          <div className="flex justify-between gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={sending}
                className="flex-1 h-11 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
            )}
            {step < 3 ? (
              <button
                disabled={step === 1 ? !canGoToStep2 : !canGoToStep3 || sending}
                onClick={() => setStep(step + 1)}
                className={`flex-1 h-11 rounded-full text-sm font-medium ${
                  (step === 1 && canGoToStep2) || (step === 2 && canGoToStep3)
                    ? "bg-[color:var(--tint)] text-white shadow active:scale-95"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                ต่อไป
              </button>
            ) : (
              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`flex-1 h-11 rounded-full text-sm font-medium ${
                  canSubmit
                    ? "bg-[color:var(--tint)] text-white shadow active:scale-95"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {sending ? "กำลังส่ง..." : "ส่งแบบฟอร์ม"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
