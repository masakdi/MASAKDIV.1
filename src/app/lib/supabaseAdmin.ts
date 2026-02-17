import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supaAdminInstance: SupabaseClient | null = null

function getSupaAdminClient(): SupabaseClient {
  if (!supaAdminInstance) {
    supaAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return supaAdminInstance
}

export const supaAdmin = new Proxy(
  {},
  {
    get: (target, prop) => {
      const client = getSupaAdminClient()
      return Reflect.get(client, prop)
    },
  }
) as SupabaseClient
