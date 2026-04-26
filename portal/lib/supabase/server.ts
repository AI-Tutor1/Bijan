import { createClient } from '@supabase/supabase-js';

// Server-side client. Uses the service-role key — never expose to the browser.
// Single-user portal: no auth, no RLS. The service role is the only credential.
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check Bijan/.env.local.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Opt out of Next 16's default fetch cache. Without this, listing pages
      // serve stale data after triage/intake mutations.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
