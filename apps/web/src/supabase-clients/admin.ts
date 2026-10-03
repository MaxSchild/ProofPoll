import 'server-only';

import { Database } from '@/lib/database.types';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client for the Solana records, which only the server writes.
 * It bypasses row-level security: never use it for reads the caller isn't
 * allowed to make, and never pass its results to the browser unfiltered.
 */
export function createSupabaseAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
