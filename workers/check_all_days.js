import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase.from('platform_sales').select('placed_at').gte('placed_at', '2026-05-01T00:00:00.000Z');
    
    const countByDay = {};
    if (data) {
        data.forEach(d => {
            const day = d.placed_at.substring(0, 10);
            countByDay[day] = (countByDay[day] || 0) + 1;
        });
    }
    const sorted = Object.entries(countByDay).sort((a,b) => a[0].localeCompare(b[0]));
    console.log("Counts:");
    sorted.forEach(([d, c]) => console.log(d, c));
}
run();
