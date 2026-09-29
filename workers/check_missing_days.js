import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    
    // fetch distinct days
    const { data, error } = await supabase.from('platform_sales').select('placed_at').gte('placed_at', '2026-05-10T00:00:00.000Z').lte('placed_at', '2026-05-15T23:59:59.000Z');
    
    const countByDay = {};
    if (data) {
        data.forEach(d => {
            const day = d.placed_at.substring(0, 10);
            countByDay[day] = (countByDay[day] || 0) + 1;
        });
    }
    console.log("Counts:", countByDay);
    console.log("Error:", error);
}
run();
