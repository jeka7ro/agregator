import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    console.log("URL:", process.env.VITE_SUPABASE_URL);
    const { error } = await supabase.from('platform_sales').upsert([{
        order_id: 'test_123',
        restaurant_id: 1,
        restaurant_name: 'Test',
        platform: 'glovo',
        total_amount: 10,
        placed_at: new Date().toISOString(),
        items: []
    }]);
    console.log("Insert Error:", error);
}
run();
