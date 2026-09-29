import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

export const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceKey || process.env.VITE_SUPABASE_ANON_KEY
);
if (!config.supabase.serviceKey) {
    console.warn('[Supabase] Service key missing – using anon key (read‑only). Writes will fail.');
}
