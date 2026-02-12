"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  type Coupon,
} from "@/app/actions/coupon";
import {
  Ticket,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Calendar,
  DollarSign,
  Percent,
  AlertCircle,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import Swal from "sweetalert2";

// ---- Theme ----
const MASAKDI_BLUE = "#1257FF";
const BLUE_GRADIENT_FROM = "from-[#1257FF]";
const BLUE_GRADIENT_TO = "to-[#3A7BFF]";

export default function AdminCouponsPage() {
  const router = useRouter();
  // Auth
  const [authOk, setAuthOk] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Data
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  // UI
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form
  const initialFormState = {
    code: "",
    description: "",
    discount_type: "fixed" as "fixed" | "percent",
    discount_value: 0,
    min_order_amount: 0,
    max_discount_amount: 0,
    usage_limit: 0,
    usage_per_user_limit: 1,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    applicable_types: ["all"],
    is_active: true,
    is_public: false,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      checkPass(token);
    }
  }, []);

  const checkPass = async (inputPass: string = password) => {
    try {
      const resp = await fetch("/api/admin/ping", {
        method: "GET",
        headers: { "x-admin-token": inputPass },
      });
      if (resp.ok) {
        sessionStorage.setItem("admin_token", inputPass);
        setAuthOk(true);
        fetchCoupons();
      } else {
        if (inputPass === password) alert("รหัสผ่านไม่ถูกต้อง");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(data);
    } catch (error) {
      console.error("Failed to load coupons", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Prepare data
    const payload: any = {
      ...formData,
      code: formData.code.toUpperCase(),
      usage_limit: formData.usage_limit > 0 ? formData.usage_limit : null,
      max_discount_amount:
        formData.max_discount_amount > 0 ? formData.max_discount_amount : null,
      end_date: formData.end_date
        ? new Date(formData.end_date).toISOString()
        : null,
      start_date: new Date(formData.start_date).toISOString(),
    };

    try {
      let result;
      if (isEditing && currentId) {
        result = await updateCoupon(currentId, payload);
      } else {
        result = await createCoupon(payload);
      }

      if (result.error) {
        Swal.fire("Error", result.error, "error");
      } else {
        Swal.fire("Success", "บันทึกคูปองเรียบร้อย", "success");
        setShowModal(false);
        fetchCoupons();
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setIsEditing(true);
    setCurrentId(coupon.id);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
      max_discount_amount: coupon.max_discount_amount || 0,
      usage_limit: coupon.usage_limit || 0,
      usage_per_user_limit: coupon.usage_per_user_limit,
      start_date: new Date(coupon.start_date).toISOString().split("T")[0],
      end_date: coupon.end_date
        ? new Date(coupon.end_date).toISOString().split("T")[0]
        : "",
      applicable_types:
        typeof coupon.applicable_types === "string"
          ? JSON.parse(coupon.applicable_types)
          : coupon.applicable_types,
      is_active: coupon.is_active,
      is_public: coupon.is_public || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      text: "คุณจะไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ลบเลย",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        const delResult = await deleteCoupon(id);
        if (delResult.error) {
          Swal.fire("Error", "ไม่สามารถลบคูปองได้: " + delResult.error, "error");
        } else {
          await fetchCoupons();
          Swal.fire("Deleted!", "ลบคูปองเรียบร้อย", "success");
        }
      } catch (err: any) {
        Swal.fire("Error", err.message, "error");
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleType = (type: string) => {
    setFormData((prev) => {
      let current = [...prev.applicable_types];

      if (type === "all") {
        return { ...prev, applicable_types: ["all"] };
      }

      // Remove "all" if selecting a specific type
      current = current.filter((t) => t !== "all");

      if (current.includes(type)) {
        const next = current.filter((t) => t !== type);
        // If nothing left, default back to "all"
        return {
          ...prev,
          applicable_types: next.length === 0 ? ["all"] : next,
        };
      } else {
        return { ...prev, applicable_types: [...current, type] };
      }
    });
  };

  // Safe Type Check Logic
  const getTypes = (coupon: Coupon) => {
    if (Array.isArray(coupon.applicable_types)) return coupon.applicable_types;
    try {
      return JSON.parse(coupon.applicable_types as any);
    } catch (e) {
      return [];
    }
  };

  const filteredCoupons = coupons.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description &&
        c.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (!authOk)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-slate-100">
            <Ticket className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold mb-6">จัดการคูปอง</h1>
          <input
            type="password"
            placeholder="รหัสผ่านผู้ดูแล"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 mb-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3">
        <div className="flex justify-between items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-slate-900">
                จัดการคูปอง
              </h1>
            </div>
          </div>
          <button
            onClick={() => {
              setIsEditing(false);
              setFormData(initialFormState);
              setShowModal(true);
            }}
            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO}`}
          >
            <Plus className="w-4 h-4" /> สร้างคูปอง
          </button>
        </div>
      </header>

      <main className="p-4 max-w-5xl mx-auto">
        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาคูปอง..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCoupons.map((coupon) => {
            const isActive =
              coupon.is_active &&
              (!coupon.end_date || new Date(coupon.end_date) > new Date());
            const types = getTypes(coupon);

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border ${!isActive ? "opacity-70" : "border-slate-100"}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold font-mono mb-1">
                      {coupon.code}
                    </span>
                    <h3 className="text-sm font-medium text-slate-900 line-clamp-1">
                      {coupon.description || "-"}
                    </h3>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}
                  >
                    {coupon.discount_type === "percent" ? (
                      <Percent className="w-4 h-4" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-500 mb-4">
                  <div className="flex justify-between">
                    <span>ส่วนลด:</span>
                    <span className="font-semibold text-slate-900">
                      {coupon.discount_value}
                      {coupon.discount_type === "percent" ? "%" : "฿"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ใช้ไปแล้ว:</span>
                    <span>
                      {coupon.used_count} / {coupon.usage_limit || "∞"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>ประเภท:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${coupon.is_public ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {coupon.is_public ? "สาธารณะ" : "ใช้โค้ด"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ใช้ได้กับ:</span>
                    <span>{types.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>หมดอายุ:</span>
                    <span>
                      {coupon.end_date
                        ? new Date(coupon.end_date).toLocaleDateString("th-TH")
                        : "ไม่มี"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleEdit(coupon)}
                    className="flex-1 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-medium hover:bg-slate-100 transition"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(coupon.id)}
                    className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="text-center py-10 text-slate-400 text-sm">
            กำลังโหลด...
          </div>
        )}

        {!loading && filteredCoupons.length === 0 && (
          <div className="text-center py-20 text-slate-400 text-sm">
            ไม่พบคูปอง
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-black">
                {isEditing ? "แก้ไขคูปอง" : "สร้างคูปองใหม่"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    รหัสคูปอง *
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono uppercase text-slate-900 transition-all shadow-sm"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="SALE2024"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    รายละเอียด
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="เช่น ส่วนลดพิเศษสำหรับช่วงสงกรานต์"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      ประเภทส่วนลด
                    </label>
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 appearance-none transition-all shadow-sm"
                        value={formData.discount_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discount_type: e.target.value as any,
                          })
                        }
                      >
                        <option value="fixed">ลดเป็นบาท (฿)</option>
                        <option value="percent">ลดเป็นเปอร์เซ็น (%)</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      มูลค่าส่วนลด {formData.discount_type === "percent" ? "(%)" : "(บาท)"} *
                    </label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                      value={formData.discount_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount_value: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      ยอดสั่งซื้อขั้นต่ำ
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                      value={formData.min_order_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_order_amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      ลดสูงสุด (บาท) {formData.discount_type === "percent" ? "" : "(ไม่ใช้)"}
                    </label>
                    <input
                      type="number"
                      placeholder="0 = ไม่จำกัด"
                      className={`w-full px-4 py-3 rounded-2xl border text-sm focus:ring-2 outline-none transition-all shadow-sm ${
                        formData.discount_type !== "percent" 
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                          : "bg-slate-50 border-slate-100 text-slate-900 focus:ring-blue-500 focus:bg-white"
                      }`}
                      value={formData.max_discount_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_discount_amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={formData.discount_type !== "percent"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      จำกัดจำนวนสิทธิ์รวม
                    </label>
                    <input
                      type="number"
                      placeholder="0 = ไม่จำกัด"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                      value={formData.usage_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usage_limit: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      จำกัดต่อคน
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                      value={formData.usage_per_user_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usage_per_user_limit: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      เริ่มใช้
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, start_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      หมดเขต (ถ้ามี)
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-slate-900 transition-all shadow-sm"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    ใช้ได้กับบริการ
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["all", "laundry", "dry", "delivery"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleType(type)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          formData.applicable_types.includes(type)
                            ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105"
                            : "bg-white text-slate-600 border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        {type === "all"
                          ? "ทั้งหมด"
                          : type === "laundry"
                            ? "ซัก"
                            : type === "dry"
                              ? "อบ"
                              : "ขนส่ง"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                      className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                    />
                    <label
                      htmlFor="isActive"
                      className="text-sm font-semibold text-slate-700"
                    >
                      เปิดใช้งาน
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.is_public}
                      onChange={(e) =>
                        setFormData({ ...formData, is_public: e.target.checked })
                      }
                      className="w-5 h-5 rounded-lg border-slate-300 text-orange-500 focus:ring-orange-500 transition-all"
                    />
                    <label
                      htmlFor="isPublic"
                      className="text-sm font-semibold text-slate-700"
                    >
                      สาธารณะ (แจกทุกคน)
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-black font-medium hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-3 rounded-xl text-white font-medium shadow-lg bg-gradient-to-r ${BLUE_GRADIENT_FROM} ${BLUE_GRADIENT_TO} hover:opacity-90 transition`}
                >
                  {loading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
