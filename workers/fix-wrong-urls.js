import { supabase } from './src/services/supabase.js';

async function run() {
    const { data } = await supabase.from('restaurants').select('id, name, city, wolt_url, glovo_url').eq('is_active', true);
    let fixedWolt = 0;
    
    for (const rest of data) {
        if (!rest.wolt_url) continue;
        
        // Extract zone from name, e.g. "SM BUC CEAIKOVSKI (Roll Master)" -> "CEAIKOVSKI"
        const nameMatch = rest.name.match(/SM\s+(?:BUC\s+)?([A-Z0-9#\s]+?)\s*\(/);
        let zone = nameMatch ? nameMatch[1].trim().toLowerCase() : null;
        
        if (zone && rest.city.toUpperCase().includes('BUC')) {
             const url = rest.wolt_url.toLowerCase();
             // Check if url contains the zone (or a reasonable approximation)
             // Halelor != Ceaikovski
             if (zone === 'ceaikovski' && url.includes('halelor')) {
                 console.log(`WRONG WOLT LINK: ${rest.name} -> ${rest.wolt_url}`);
                 await supabase.from('restaurants').update({ wolt_url: null }).eq('id', rest.id);
                 fixedWolt++;
             }
             if (zone === 'cora' && url.includes('halelor')) {
                 console.log(`WRONG WOLT LINK: ${rest.name} -> ${rest.wolt_url}`);
                 await supabase.from('restaurants').update({ wolt_url: null }).eq('id', rest.id);
                 fixedWolt++;
             }
             if (zone === 'unirii' && url.includes('halelor') && !url.includes('unirii')) {
                 console.log(`WRONG WOLT LINK: ${rest.name} -> ${rest.wolt_url}`);
                 await supabase.from('restaurants').update({ wolt_url: null }).eq('id', rest.id);
                 fixedWolt++;
             }
        }
    }
    console.log("Cleared", fixedWolt, "wrong Wolt URLs.");
    process.exit(0);
}
run();
