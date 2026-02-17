import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseServerInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!supabaseServerInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
    supabaseServerInstance = createClient(url, service, {
      auth: { persistSession: false },
    })
  }
  return supabaseServerInstance
}

export const supabaseServer = new Proxy(
  {},
  {
    get: (target, prop) => {
      const client = getSupabaseClient()
      return Reflect.get(client, prop)
    },
  }
) as SupabaseClient
