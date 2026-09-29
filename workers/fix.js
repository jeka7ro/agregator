import dotenv from 'dotenv'
import path from 'path'

// MUST load env before importing anything else because imports are hoisted
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') })
!process.env.VITE_SUPABASE_URL && dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run() {
    const { discoverSingleRestaurant } = await import('./src/utils/auto-discover.js')
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    console.log("-> Căutăm restaurantele active, dar fără niciun link pe agregator...");
    const { data: restaurants } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true);
        
    const missing = restaurants.filter(r => !r.glovo_url && !r.wolt_url && !r.bolt_url);
    
    if (missing.length === 0) {
        console.log("-> Toate restaurantele au deja linkuri!");
        return;
    }
    
    console.log(`-> Găsite ${missing.length} restaurante fără linkuri: ` + missing.map(m=>m.name).join(', '));
    
    for (const rest of missing) {
         console.log(`\n============== Rezolvare [${rest.name}] ==============`);
         try {
             const result = await discoverSingleRestaurant(rest);
             if (result.success) {
                 console.log(`[SUCCESS] Gasite linkuri pentru ${rest.name}:`, result.urls);
             } else {
                 console.log(`[WARNING] Nu s-au putut gasi automat linkuri pentru ${rest.name}`);
             }
         } catch (e) {
             console.error(`[EROARE SCRAPER] ${rest.name}: ${e.message}`);
         }
    }
    
    console.log("\n-> Proces de mapare complet!");
}

run();
