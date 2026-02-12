"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function ConditionalBottomNav() {
  const pathname = usePathname();

  // ซ่อน BottomNav ในหน้า Admin
  if (pathname.startsWith("/Admins")) {
    return null;
  }

  return <BottomNav />;
}
