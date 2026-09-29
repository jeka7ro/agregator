import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data } = await supabase.from('platform_sales').select('placed_at').gte('placed_at', '2026-05-04T00:00:00.000Z').lte('placed_at', '2026-05-04T23:59:59.999Z').limit(10);
    console.log("Day 4:", data);
}
run();
