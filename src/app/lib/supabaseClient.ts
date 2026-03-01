'use client'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClientInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY

    if (!url || !anon) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    supabaseClientInstance = createClient(url, anon, {
      auth: {
        persistSession: true,   // เก็บ session user ใน localStorage
        autoRefreshToken: true, // ต่ออายุ token อัตโนมัติ
      },
      realtime: {
        params: { eventsPerSecond: 2 },
      },
      global: {
        headers: { 'x-my-custom-header': 'laundry-app' },
      },
    })
  }
  return supabaseClientInstance
}

/**
 * ใช้สำหรับฝั่ง client (browser)
 * - ผู้ใช้ล็อกอินด้วย LINE หรือ Supabase Auth
 * - RLS จะทำงานอัตโนมัติ เพราะ JWT ถูกแนบใน header ทุก request
 */
export const supa = new Proxy(
  {},
  {
    get: (target, prop) => {
      const client = getSupabaseClient()
      return Reflect.get(client, prop)
    },
  }
) as SupabaseClient

/* ===== Storage Buckets ===== */
// สลิปชำระเงิน
export const BUCKET_SLIPS = 'uploads-slips'

// รูปตะกร้าผ้า
export const BUCKET_BASKETS = 'uploads-baskets'

// รูปจากการรีพอร์ต
export const BUCKET_REPORTS = 'uploads-reports'

/* ===== Other Config ===== */
export const QR_URL = process.env.NEXT_PUBLIC_QR_CODE_IMAGE_URL || ''
