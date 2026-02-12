"use client";

import { usePathname } from "next/navigation";
import ClientGlobalLoader from "../components/ClientGlobalLoader";
import BottomNav from "../components/BottomNav";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // ซ่อน Bottom Dashboard ในหน้า Admin ทั้งหมด
  const hideBottomNav = pathname.startsWith("/Admins");

  return (
    <>
      <ClientGlobalLoader />
      <div className="min-h-[100dvh]">{children}</div>
      {!hideBottomNav && <BottomNav />}
    </>
  );
}
