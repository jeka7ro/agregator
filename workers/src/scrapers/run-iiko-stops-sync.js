import fetch from 'node-fetch';
import { supabase } from '../services/supabase.js';

const ENVIRONMENTS = [
    { key: 'a1fe30cdeb934aa0af01b6a35244b7f0', baseUrl: 'https://api-eu.syrve.live/api/1' },
    { key: '124d0880f4b44717b69ee21d45fc2656', baseUrl: 'https://api-eu.syrve.live/api/1' }
];

async function syncAllIikoStops() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 INIT SINCRONIZARE BACKGROUND IIKO...`);
    
    // Fetch all mapped restaurants from Supabase
    const { data: restaurants, error } = await supabase.from('restaurants').select('*').not('iiko_restaurant_id', 'is', null);
    if (!restaurants || restaurants.length === 0) {
        console.log("⚠️ Zero restaurante mapate in DB cu iiko_restaurant_id.");
        return;
    }
    const orgIdsInDb = restaurants.map(r => r.iiko_restaurant_id).filter(Boolean);

    // Build global menu map from Supabase Catalog (since it's already perfectly synced by the other script)
    const { data: catalog } = await supabase.from('iiko_catalog').select('iiko_id, name');
    const menuMap = new Map();
    if(catalog) {
         catalog.forEach(c => menuMap.set(c.iiko_id, c.name));
    }

    let totalUpdated = 0;
    let globalStoppedCount = 0;

    for (const env of ENVIRONMENTS) {
        // Auth
        const resAuth = await fetch(`${env.baseUrl}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: env.key })
        });
        if (!resAuth.ok) continue;
        const { token } = await resAuth.json();

        // Get Stops
        const resStops = await fetch(`${env.baseUrl}/stop_lists`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationIds: orgIdsInDb })
        });
        
        let terminalGroupStopLists = [];
        try {
            const data = await resStops.json();
            terminalGroupStopLists = data.terminalGroupStopLists || [];
        } catch(e) {
            continue;
        }

        // Group stops by Organization ID
        const stopsByOrg = {};
        for (const group of terminalGroupStopLists) {
            if (!stopsByOrg[group.organizationId]) stopsByOrg[group.organizationId] = [];
            
            // Wait, we need to iterate group.items which are terminal groups
            const terminalGroups = group.items || [];
            for(const tGroup of terminalGroups) {
                 const products = tGroup.items || [];
                 stopsByOrg[group.organizationId].push(...products);
            }
        }

        // Update EACH restaurant assigned to this env in Supabase
        for (const rest of restaurants) {
            const orgId = rest.iiko_restaurant_id;
            const rawItems = stopsByOrg[orgId];
            
            // If rawItems is undefined, it means this org might not belong to this env. We skip it, or clear it if it does.
            // Actually iiko returns empty terminalGroupStopLists for orgs it doesn't own. 
            if (!rawItems && !Object.keys(stopsByOrg).length) continue; 
            if (rawItems === undefined) continue;

            const enhancedStops = rawItems.map(item => ({
                 productId: item.productId,
                 productName: menuMap.get(item.productId) || 'Produs fără nume',
                 balance: item.balance,
                 dateAdd: item.dateAdd
            }));
            
            globalStoppedCount += enhancedStops.length;

            // Build newly merged JSONB configuration
            const newConfig = {
                ...(rest.iiko_config || {}),
                iiko_live_stops: enhancedStops,
                iiko_last_sync_time: new Date().toISOString()
            };

            const { error: updErr } = await supabase.from('restaurants').update({ iiko_config: newConfig }).eq('id', rest.id);
            if (updErr) {
                console.error(`Eroare db la org ${rest.name}:`, updErr.message);
            } else {
                totalUpdated++;
            }
        }
    }

    console.log(`✅ Sincronizare finalizata! Au fost detectate ${globalStoppedCount} produse oprite in total. Baza de date actualizata pentru ${totalUpdated} restaurante.`);
}

syncAllIikoStops();
setInterval(syncAllIikoStops, 60000);
