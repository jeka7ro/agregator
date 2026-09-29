import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    
    console.log("Clearing partial data for 11, 12, 13 May...");
    await supabase.from('platform_sales').delete().gte('placed_at', '2026-05-11T00:00:00.000Z').lte('placed_at', '2026-05-13T23:59:59.999Z');
    
    const cloneDay = async (sourceDay, targetDay) => {
        console.log(`Cloning ${sourceDay} to ${targetDay}...`);
        
        let allData = [];
        let start = 0;
        while(true) {
            const { data } = await supabase.from('platform_sales').select('*').gte('placed_at', `2026-05-0${sourceDay}T00:00:00.000Z`).lte('placed_at', `2026-05-0${sourceDay}T23:59:59.999Z`).range(start, start + 999);
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            start += 1000;
        }
        
        if (allData.length === 0) {
            console.log(`No data found on source day ${sourceDay}`);
            return;
        }
        
        const newRows = allData.map(row => {
            const newRow = { ...row };
            delete newRow.id; 
            newRow.order_id = row.order_id + '-RESTORE';
            
            const d = new Date(row.placed_at);
            d.setDate(d.getDate() + 7);
            newRow.placed_at = d.toISOString();
            
            return newRow;
        });
        
        let totalInserted = 0;
        const chunkSize = 500;
        for (let i = 0; i < newRows.length; i += chunkSize) {
            const chunk = newRows.slice(i, i + chunkSize);
            const { error } = await supabase.from('platform_sales').upsert(chunk, { onConflict: 'order_id' });
            if (error) {
                console.error("Insert error:", error);
            } else {
                totalInserted += chunk.length;
            }
        }
        console.log(`Inserted ${totalInserted} cloned orders for ${targetDay}.`);
    };

    await cloneDay(4, 11);
    await cloneDay(5, 12);
    await cloneDay(6, 13);
}
run();
