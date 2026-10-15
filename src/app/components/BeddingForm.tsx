"use client";

import {
  BEDDING_SIZE_LABEL,
  BEDDING_THICKNESS_LABEL,
  setKey,
  type BeddingLine,
  type BeddingOrder,
  type BeddingSize,
  type BeddingThickness,
} from "@/app/lib/bedding";

const SIZES: BeddingSize[] = ["3.5", "5-6"];
const THICKNESSES: BeddingThickness[] = ["thin", "thick"];

const Stepper = ({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      disabled={value <= min}
      onClick={() => onChange(value - 1)}
      className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 font-bold disabled:text-slate-300"
    >
      −
    </button>
    <span className="w-8 text-center text-sm font-bold tabular-nums">{value}</span>
    <button
      type="button"
      onClick={() => onChange(value + 1)}
      className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 font-bold"
    >
      +
    </button>
  </div>
);

const chip = (active: boolean) =>
  `h-10 flex-1 rounded-xl text-sm font-medium transition-all ${
    active ? "bg-[color:var(--tint)] text-white" : "bg-slate-100 text-slate-700"
  }`;

export default function BeddingForm({
  value,
  onChange,
  prices,
}: {
  value: BeddingOrder;
  onChange: (v: BeddingOrder) => void;
  prices: Record<string, number> | null;
}) {
  if (!prices) {
    return <p className="py-8 text-center text-sm text-slate-400">กำลังโหลดราคา...</p>;
  }
  if (!SIZES.some((s) => THICKNESSES.some((t) => prices[setKey(s, t)] !== undefined))) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        ขณะนี้ยังไม่เปิดบริการซักเครื่องนอน
      </p>
    );
  }

  const set = (patch: Partial<BeddingOrder>) => onChange({ ...value, ...patch });
  const updateLine = (id: number, patch: Partial<BeddingLine>) =>
    set({ lines: value.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () =>
    set({ lines: [...value.lines, { id: Date.now(), size: "3.5", thickness: "thin", qty: 1 }] });
  const removeLine = (id: number) => set({ lines: value.lines.filter((l) => l.id !== id) });

  const price = (k: string) => prices[k];

  return (
    <div className="space-y-4">
      {value.lines.length === 0 && (
        <div className="py-8 flex justify-center">
          <button
            type="button"
            onClick={addLine}
            className="h-11 px-8 rounded-full bg-[color:var(--tint)] text-sm text-white shadow active:scale-95"
          >
            เพิ่มชุดเครื่องนอน
          </button>
        </div>
      )}

      {value.lines.map((l, idx) => (
        <section key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">เครื่องนอน {idx + 1}</h3>
            <button
              type="button"
              onClick={() => removeLine(l.id)}
              className="text-xs text-rose-600 underline"
            >
              ลบ
            </button>
          </div>

          <p className="mb-2 text-xs text-slate-500 font-medium">ขนาดชุดเครื่องนอน</p>
          <div className="mb-3 flex gap-2">
            {SIZES.map((s) => (
              <button key={s} type="button" onClick={() => updateLine(l.id, { size: s })} className={chip(l.size === s)}>
                {BEDDING_SIZE_LABEL[s]}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs text-slate-500 font-medium">ประเภทผ้า</p>
          <div className="mb-3 flex gap-2">
            {THICKNESSES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateLine(l.id, { thickness: t })}
                className={chip(l.thickness === t)}
              >
                {BEDDING_THICKNESS_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">จำนวนชุด</p>
              <p className="text-xs font-bold text-[color:var(--tint)]">
                ราคา {price(setKey(l.size, l.thickness)) ?? "-"} บาท/ชุด
              </p>
            </div>
            <Stepper value={l.qty} min={1} onChange={(n) => updateLine(l.id, { qty: n })} />
          </div>
        </section>
      ))}

      {value.lines.length > 0 && (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addLine}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-900 font-bold"
              >
                +
              </button>
              <span className="text-sm text-slate-600 font-medium">เพิ่มชุดเครื่องนอน</span>
            </div>
            <span className="text-sm text-slate-600 font-medium">รวม {value.lines.length} รายการ</span>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-medium">รายการเพิ่มเติม</h3>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                เพิ่มผ้าห่มแบบบาง (+{price("extra_thin_blanket") ?? 0} บาท/ผืน)
              </span>
              <Stepper value={value.extra_thin} onChange={(n) => set({ extra_thin: n })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                เพิ่มผ้าห่ม/ผ้านวมแบบหนา (+{price("extra_thick_blanket") ?? 0} บาท/ผืน)
              </span>
              <Stepper value={value.extra_thick} onChange={(n) => set({ extra_thick: n })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                เพิ่มผ้าปู/ปลอกหมอน <span className="text-emerald-600">(ฟรี)</span>
              </span>
              <Stepper value={value.extra_sheet} onChange={(n) => set({ extra_sheet: n })} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs text-slate-500 font-medium">น้ำยาเพิ่มเติม (คิดครั้งเดียวต่อออเดอร์)</p>
            <div className="flex gap-2">
              {(
                [
                  ["softener", "ปรับผ้านุ่ม"],
                  ["detergent", "ผงซักฟอก"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set({ [k]: !value[k] })}
                  className={`flex-1 h-10 rounded-full px-3 text-sm font-bold transition-all ${
                    value[k]
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {value[k] ? `${label} ✓` : `${label} +${price(k) ?? 0}฿`}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
