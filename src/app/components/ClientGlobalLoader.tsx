"use client";
import { useEffect, useState } from "react";

const MIN_VISIBLE_MS = 1200; // ลดเวลาให้เหมาะสม
const LOADER_KEY = "masakdi_initial_load_done";

export default function ClientGlobalLoader() {
  // ✅ เช็คว่าเคยโหลดไปแล้วหรือยัง
  const [show, setShow] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem(LOADER_KEY);
    }
    return true;
  });
  const [fadeOut, setFadeOut] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    // ✅ ถ้าเคยโหลดไปแล้ว ไม่ต้องแสดง loader เลย
    if (sessionStorage.getItem(LOADER_KEY)) {
      setShow(false);
      return;
    }

    const inTimer = setTimeout(() => setFadeIn(true), 100);

    const start = performance.now();
    const hide = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      const t = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          setShow(false);
          // ✅ บันทึกว่าโหลดไปแล้ว
          sessionStorage.setItem(LOADER_KEY, "true");
        }, 400);
      }, wait);
      return () => clearTimeout(t);
    };

    // ✅ ใช้ event DOMContentLoaded แทน window.load
    if (document.readyState === "complete" || document.readyState === "interactive") {
      hide();
    } else {
      const onReady = () => hide();
      document.addEventListener("DOMContentLoaded", onReady);
      return () => {
        document.removeEventListener("DOMContentLoaded", onReady);
        clearTimeout(inTimer);
      };
    }
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      } bg-white`}
    >
      <img
        src="/Icons/Draft 1.png"
        alt="MASAKDI"
        className={`relative z-10 w-[80vw] max-w-[340px] object-contain select-none transition-opacity duration-1000 ${
          fadeIn ? "opacity-100" : "opacity-0"
        }`}
        draggable={false}
      />
    </div>
  );
}
