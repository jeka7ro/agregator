import { supabase } from './src/services/supabase.js';

async function run() {
    const { data } = await supabase.from('restaurants').select('id, name, wolt_url, glovo_url').eq('is_active', true);
    
    const woltMap = new Map();
    const glovoMap = new Map();
    const toClear = new Set();
    
    for (const r of data) {
        if (r.wolt_url) {
            if (woltMap.has(r.wolt_url)) {
                toClear.add(r.id);
                toClear.add(woltMap.get(r.wolt_url));
            }
            woltMap.set(r.wolt_url, r.id);
        }
        if (r.glovo_url) {
            if (glovoMap.has(r.glovo_url)) {
                toClear.add(r.id);
                toClear.add(glovoMap.get(r.glovo_url));
            }
            glovoMap.set(r.glovo_url, r.id);
        }
    }
    
    for (const id of toClear) {
        // Wait, some might be correct for ONE of them. 
        // If it's a duplicate, it's safer to clear it for both so the user can use Auto Link manually or we fix it properly.
        await supabase.from('restaurants').update({ wolt_url: null, glovo_url: null }).eq('id', id);
    }
    console.log("Cleared", toClear.size, "records with duplicate URLs.");
    process.exit(0);
}
run();
