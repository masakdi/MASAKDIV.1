import { createClient } from "@supabase/supabase-js";

export const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,               // safe to be public
  process.env.SUPABASE_SERVICE_ROLE_KEY!,              // NEVER expose to client
  { auth: { persistSession: false } }
);
