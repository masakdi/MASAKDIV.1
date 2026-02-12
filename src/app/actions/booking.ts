"use client";

import { supa } from "@/app/lib/supabaseClient";

export type BookingConfig = {
  id: string;
  day_of_week: number;
  is_active: boolean;
  max_orders_per_day: number;
};

export async function getBookingConfigs() {
  const { data, error } = await supa
    .from("booking_configs")
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) throw error;
  return data as BookingConfig[];
}

export async function toggleBookingDay(dayOfWeek: number, isActive: boolean) {
  const { data, error } = await supa
    .from("booking_configs")
    .upsert(
      { day_of_week: dayOfWeek, is_active: isActive },
      { onConflict: "day_of_week" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMaxOrders(dayOfWeek: number, maxOrders: number) {
  const { data, error } = await supa
    .from("booking_configs")
    .update({ max_orders_per_day: maxOrders })
    .eq("day_of_week", dayOfWeek)
    .select()
    .single();

  if (error) throw error;
  return data;
}
