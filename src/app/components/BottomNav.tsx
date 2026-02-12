"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Shirt, ClipboardList, AlertCircle, Crown, Ticket } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { id: "home", label: "สั่งซักผ้า", icon: Shirt, path: "/" },
    { id: "orders", label: "ประวัติ", icon: ClipboardList, path: "/Users/HistoryOrders" },
    { id: "coupons", label: "คูปอง", icon: Ticket, path: "/Users/Coupons" },
    { id: "membership", label: "สมาชิก", icon: Crown, path: "/Users/Membership" },
    { id: "report", label: "แจ้งปัญหา", icon: AlertCircle, path: "/Users/Report" },
  ] as const;

  const active = useMemo(
    () => navItems.find((n) => n.path === pathname)?.id || "home",
    [pathname]
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center bg-white border-t border-blue-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="เมนูหลัก"
    >
      <div className="relative w-full max-w-md px-4">
        <div className="h-[64px] w-full rounded-[20px] flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center transition-colors duration-200"
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 1.8 : 1.4}
                  className={isActive ? "text-blue-500" : "text-slate-400"}
                />
                <span
                  className={`text-[13px] mt-1 ${
                    isActive ? "text-blue-500 font-semibold" : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
