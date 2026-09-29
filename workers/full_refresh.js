import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { discoverSingleRestaurant } from './src/utils/auto-discover.js';
import { supabase } from './src/services/supabase.js';

async function run() {
    console.log('[Full Refresh] Preluare restaurante active...');
    const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('[Full Refresh] Eroare preluare:', error);
        return;
    }

    console.log(`[Full Refresh] S-au gasit ${restaurants.length} restaurante active.`);

    for (let i = 0; i < restaurants.length; i++) {
        const rest = restaurants[i];
        console.log(`\n[Full Refresh] (${i + 1}/${restaurants.length}) Cautare linkuri pentru: ${rest.name}`);
        
        try {
            await discoverSingleRestaurant(rest);
        } catch (e) {
            console.error(`[Full Refresh] Eroare la restaurantul ${rest.name}:`, e.message);
        }
        
        // Asteapta putin intre cereri pentru a nu fi blocati de site-uri
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\n[Full Refresh] FINALIZAT COMPLET!');
}

run();
