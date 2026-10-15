"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Phone, RefreshCw, Search, Star } from "lucide-react";

type ReviewRow = {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order: {
    order_number: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    created_at: string;
    total_amount: number | null;
  } | null;
};

type Filter = "all" | "comment" | 1 | 2 | 3 | 4 | 5;

const BLUE_GRADIENT = "bg-gradient-to-r from-[#1257FF] to-[#3A7BFF]";

const formatDate = (ts: string) =>
  new Date(ts).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const Stars = ({ value, size = 14 }: { value: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-200"}
      />
    ))}
  </div>
);

export default function ReviewsAdminPage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [password, setPassword] = useState("");
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

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
        fetchReviews(inputPass);
      } else if (inputPass === password) {
        alert("รหัสผ่านไม่ถูกต้อง");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReviews = async (token = sessionStorage.getItem("admin_token") || "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reviews", {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "โหลดรีวิวไม่สำเร็จ");
      setReviews(d.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ===== สรุปภาพรวม ===== */
  const stats = useMemo(() => {
    const total = reviews.length;
    const counts = [0, 0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of reviews) {
      counts[r.rating]++;
      sum += r.rating;
    }
    return {
      total,
      counts,
      avg: total ? sum / total : 0,
      positive: total ? ((counts[4] + counts[5]) / total) * 100 : 0,
      withComment: reviews.filter((r) => r.comment).length,
    };
  }, [reviews]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      if (filter === "comment" && !r.comment) return false;
      if (typeof filter === "number" && r.rating !== filter) return false;
      if (!q) return true;
      return [r.order?.order_number, r.order?.contact_name, r.order?.contact_phone, r.comment]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [reviews, filter, query]);

  if (!authOk)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center border border-slate-200">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-amber-50">
            <Star className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2">รีวิวจากลูกค้า</h1>
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
            className={`w-full py-3 text-white rounded-2xl font-medium shadow-lg ${BLUE_GRADIENT}`}
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 rounded-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold">รีวิวจากลูกค้า</h1>
            </div>
          </div>
          <button
            onClick={() => fetchReviews()}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-90 transition-all"
            aria-label="รีเฟรช"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto mt-2 space-y-4">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* ===== ภาพรวม ===== */}
        <section className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 bg-white rounded-3xl border border-slate-200 p-5">
          <div className="flex flex-col items-center justify-center text-center sm:border-r sm:border-slate-100 sm:pr-4">
            <p className="text-4xl font-bold">{stats.avg.toFixed(1)}</p>
            <Stars value={Math.round(stats.avg)} size={18} />
            <p className="text-xs text-slate-500 mt-1">{stats.total} รีวิว</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-emerald-600">{stats.positive.toFixed(0)}%</p>
                <p>4-5 ดาว</p>
              </div>
              <div>
                <p className="font-semibold">{stats.withComment}</p>
                <p>มีคอมเมนต์</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = stats.counts[n];
              const pct = stats.total ? (count / stats.total) * 100 : 0;
              const active = filter === n;
              return (
                <button
                  key={n}
                  onClick={() => setFilter(active ? "all" : (n as Filter))}
                  className={`w-full flex items-center gap-3 rounded-xl px-2 py-1 text-xs transition ${
                    active ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="w-10 flex items-center gap-1 text-slate-600">
                    {n} <Star size={12} className="fill-amber-400 text-amber-400" />
                  </span>
                  <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${n >= 4 ? "bg-emerald-500" : n === 3 ? "bg-amber-400" : "bg-rose-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-8 text-right tabular-nums text-slate-600">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ===== ตัวกรอง ===== */}
        <section className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขออเดอร์ / ชื่อ / เบอร์ / คอมเมนต์"
              className="w-full h-11 rounded-2xl bg-white pl-9 pr-4 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["all", "ทั้งหมด"],
                ["comment", "มีคอมเมนต์"],
                [5, "5 ดาว"],
                [4, "4 ดาว"],
                [3, "3 ดาว"],
                [2, "2 ดาว"],
                [1, "1 ดาว"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={String(key)}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs font-medium transition ${
                  filter === key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ===== รายการรีวิว ===== */}
        <section className="space-y-3">
          {loading && reviews.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm animate-pulse">กำลังโหลดข้อมูล...</p>
          ) : visible.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">ยังไม่มีรีวิว</p>
          ) : (
            visible.map((r) => (
              <article
                key={r.id}
                className={`bg-white rounded-2xl border p-4 ${r.rating <= 2 ? "border-rose-200" : "border-slate-200"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">
                      {r.order?.order_number || `#${r.order_id.slice(0, 8)}`}
                      <span className="ml-2 font-normal text-slate-500">
                        {r.order?.contact_name || "-"}
                      </span>
                    </p>
                    {r.order?.contact_phone && (
                      <a
                        href={`tel:${r.order.contact_phone}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-600"
                      >
                        <Phone size={12} /> {r.order.contact_phone}
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Stars value={r.rating} />
                    <p className="text-[11px] text-slate-400 mt-1">{formatDate(r.created_at)}</p>
                  </div>
                </div>
                {r.comment ? (
                  <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-line">
                    <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    {r.comment}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">ไม่มีคอมเมนต์</p>
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
