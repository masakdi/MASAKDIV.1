"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { ArrowLeft, User, Phone, MapPin, Calendar, Link as LinkIcon, Crown, Camera, ImageIcon, DollarSign } from "lucide-react";
import Swal from "sweetalert2";

export default function MembershipRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    phone: "",
    gender: "",
    birthDate: "",
    address: "",
    googleMapLink: "",
  });



  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID_HOME!;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          await liff.login({ redirectUri: window.location.href });
          return;
        }

        // ดึงข้อมูลผู้ใช้ที่มีอยู่แล้ว (ถ้ามี)
        const userId = sessionStorage.getItem("user_id");
        if (userId) {
          // TODO: ดึงข้อมูลจาก database มาเติมในฟอร์ม
        }
      } catch (err) {
        console.error("Error initializing LIFF:", err);
      }
    };

    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 10);
    if (numbers.length === 0) return "";
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData((prev) => ({ ...prev, phone: formatted }));
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = "กรุณากรอกชื่อ";
    if (!formData.lastName.trim()) newErrors.lastName = "กรุณากรอกนามสกุล";
    if (!formData.nickname.trim()) newErrors.nickname = "กรุณากรอกชื่อเล่น";
    
    const phoneNumbers = formData.phone.replace(/\D/g, "");
    if (!phoneNumbers) {
      newErrors.phone = "กรุณากรอกเบอร์โทรศัพท์";
    } else if (phoneNumbers.length !== 10) {
      newErrors.phone = "เบอร์โทรศัพท์ไม่ถูกต้อง";
    }

    if (!formData.gender) newErrors.gender = "กรุณาเลือกเพศ";
    if (!formData.birthDate) newErrors.birthDate = "กรุณาเลือกวันเกิด";
    if (!formData.address.trim()) newErrors.address = "กรุณากรอกที่อยู่";
    if (!slip) newErrors.slip = "กรุณาแนบสลิปการโอนเงิน";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      Swal.fire({
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกข้อมูลให้ครบถ้วน",
        icon: "warning",
        confirmButtonText: "ตกลง",
      });
      return;
    }

    setLoading(true);

    try {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) {
        throw new Error("ไม่พบข้อมูลผู้ใช้");
      }

      // 1. อัปโหลดสลิป
      let slipUrl = null;
      if (slip) {
        const { supa, BUCKET_SLIPS } = await import("@/app/lib/supabaseClient");
        const ext = slip.name.split(".").pop() || "jpg";
        const path = `membership-registration/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supa.storage.from(BUCKET_SLIPS).upload(path, slip);
        if (uploadError) throw uploadError;
        slipUrl = supa.storage.from(BUCKET_SLIPS).getPublicUrl(uploadData.path).data.publicUrl;
      }

      // 2. อัพเดทข้อมูลผู้ใช้
      const response = await fetch("/api/membership/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          nickname: formData.nickname.trim(),
          phone: formData.phone.replace(/\D/g, ""),
          gender: formData.gender,
          birth_date: formData.birthDate,
          address: formData.address.trim(),
          google_map_link: formData.googleMapLink.trim() || null,
          slip_url: slipUrl, // ส่งสลิปไปด้วย
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      await Swal.fire({
        title: "ส่งข้อมูลสำเร็จ! 🎉",
        text: "รอ Admin ตรวจสอบการชำระเงินเพื่อเปิดใช้งานสมาชิก",
        icon: "success",
        confirmButtonText: "ตกลง",
      });

      router.push("/Users/Membership");
    } catch (err: any) {
      console.error("Error submitting form:", err);
      Swal.fire({
        title: "เกิดข้อผิดพลาด",
        text: err.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonText: "ตกลง",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">สมัครสมาชิก</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 py-6 pb-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ข้อมูลส่วนตัว */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-blue-500" />
              ข้อมูลส่วนตัว
            </h2>

            <div className="space-y-4">
              {/* ชื่อ */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.firstName ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black placeholder:text-slate-400`}
                  placeholder="กรอกชื่อ"
                />
                {errors.firstName && (
                  <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                )}
              </div>

              {/* นามสกุล */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">
                  นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.lastName ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black placeholder:text-slate-400`}
                  placeholder="กรอกนามสกุล"
                />
                {errors.lastName && (
                  <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                )}
              </div>

              {/* ชื่อเล่น */}
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อเล่น <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.nickname ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black placeholder:text-slate-400`}
                  placeholder="กรอกชื่อเล่น"
                />
                {errors.nickname && (
                  <p className="text-xs text-red-600 mt-1">{errors.nickname}</p>
                )}
              </div>

              {/* เพศ */}
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">
                  เพศ <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.gender ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors bg-white text-black`}
                >
                  <option value="">เลือกเพศ</option>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                  <option value="other">อื่นๆ</option>
                </select>
                {errors.gender && (
                  <p className="text-xs text-red-500 mt-1">{errors.gender}</p>
                )}
              </div>

              {/* วันเกิด */}
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-slate-700 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  วันเกิด <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.birthDate ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black`}
                />
                {errors.birthDate && (
                  <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* ข้อมูลติดต่อ */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Phone size={18} className="text-green-500" />
              ข้อมูลติดต่อ
            </h2>

            <div className="space-y-4">
              {/* เบอร์โทรศัพท์ */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.phone ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black placeholder:text-slate-400`}
                  placeholder="0XX-XXX-XXXX"
                />
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
                )}
              </div>

              {/* ที่อยู่ */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                  <MapPin size={16} className="inline mr-1" />
                  ที่อยู่ <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.address ? "border-red-300" : "border-slate-200"
                  } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors resize-none text-black placeholder:text-slate-400`}
                  placeholder="กรอกที่อยู่สำหรับรับ-ส่งผ้า"
                />
                {errors.address && (
                  <p className="text-xs text-red-600 mt-1">{errors.address}</p>
                )}
              </div>

              {/* Google Map Link */}
              <div>
                <label htmlFor="googleMapLink" className="block text-sm font-medium text-slate-700 mb-1">
                  <LinkIcon size={16} className="inline mr-1" />
                  Google Map Link (ถ้ามี)
                </label>
                <input
                  type="url"
                  id="googleMapLink"
                  name="googleMapLink"
                  value={formData.googleMapLink}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-black placeholder:text-slate-400"
                  placeholder="https://maps.google.com/..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  💡 ช่วยให้เราหาที่อยู่ของคุณได้ง่ายขึ้น
                </p>
              </div>
            </div>
          </div>

          {/* การชำระเงิน */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-blue-50">
            <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <DollarSign size={18} className="text-blue-600" />
              ชำระค่าสมาชิก
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              ค่าสมัครสมาชิกรายเดือนเพียง <span className="text-blue-600 font-black text-xl">99.-</span> บาท เพื่อรับสิทธิพิเศษและส่วนลดมากมาย
            </p>

            <div className="space-y-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Scan QR เพื่อชำระเงิน 99 บาท</p>
                <div className="inline-block p-4 bg-white rounded-3xl border border-slate-100 shadow-sm transition-transform active:scale-95">
                  <img
                    src="/promptpay-qr.png"
                    alt="PromptPay"
                    className="w-40 h-40 object-contain mx-auto"
                  />
                  <p className="text-[10px] font-bold text-blue-600 mt-2 uppercase">บริษัท มาซักดิ จำกัด</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700">
                  แนบสลิปการโอนเงิน <span className="text-red-500">*</span>
                </label>
                
                {slip ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group">
                    {slipPreview && <img src={slipPreview} alt="Slip" className="w-full h-auto" />}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => { setSlip(null); setSlipPreview(null); }}
                        className="bg-white text-rose-500 px-4 py-2 rounded-xl font-bold text-sm shadow-lg active:scale-95"
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
                      <div className={`h-28 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
                        errors.slip ? "border-red-300 bg-red-50 text-red-400" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-500 hover:text-blue-500"
                      }`}>
                        <Camera size={28} className="mb-2" />
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
                      <div className={`h-28 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
                        errors.slip ? "border-red-300 bg-red-50 text-red-400" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-500 hover:text-blue-500"
                      }`}>
                        <ImageIcon size={28} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">เลือกจากเครื่อง</span>
                      </div>
                    </label>
                  </div>
                )}
                {errors.slip && <p className="text-xs text-red-600 font-medium text-center">{errors.slip}</p>}
              </div>
            </div>
          </div>



          {/* Submit Button */}
          <div className="sticky bottom-0 bg-slate-50 pt-4 pb-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "กำลังบันทึก..." : "สมัครสมาชิก"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
