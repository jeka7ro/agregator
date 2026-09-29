import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const sourceDay = 4;
    const targetDay = 11;
    
    let allData = [];
    let start = 0;
    while(true) {
        const { data } = await supabase.from('platform_sales').select('*').gte('placed_at', `2026-05-0${sourceDay}T00:00:00.000Z`).lte('placed_at', `2026-05-0${sourceDay}T23:59:59.999Z`).range(start, start + 999);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        start += 1000;
    }
    console.log("Found:", allData.length);
    
    if (allData.length > 0) {
        const newRows = allData.map(row => {
            const newRow = { ...row };
            delete newRow.id; 
            newRow.order_id = row.order_id + '-RESTORE';
            const d = new Date(row.placed_at);
            d.setDate(d.getDate() + 7);
            newRow.placed_at = d.toISOString();
            return newRow;
        });
        const { error } = await supabase.from('platform_sales').upsert(newRows, { onConflict: 'order_id' });
        if (error) console.error("Err", error);
        else console.log("Success day 11");
    }
}
run();
