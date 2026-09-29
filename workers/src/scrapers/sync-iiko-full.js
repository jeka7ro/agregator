import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.iiko.services/api/1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncAll() {
    console.log("🚀 START SINCRONIZARE MASIVA IIKO -> BAZA DE DATE (ULTIMELE 7 ZILE)");

    // 1. Auth iiko
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const authData = await resAuth.json();
    if (!authData.token) throw new Error("Nu s-a putut obtine tokenul iiko");
    const token = authData.token;
    console.log("✅ Token obtinut");

    // 2. Fetch iiko orgs
    const resOrgs = await fetch(`${BASE_URL}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
    });
    const { organizations } = await resOrgs.json();

    // 3. Fetch supabase restaurants
    let { data: dbRests } = await supabase.from('restaurants').select('*');
    
    // 4. Map and Update
    for (const org of organizations) {
        // match name loosely
        let matched = dbRests.find(dr => dr.name.toLowerCase() === org.name.toLowerCase() || org.name.toLowerCase().includes(dr.name.toLowerCase()));
        if (!matched) {
             // Fallback: match by city? Or try to replace words
             const cleanName = org.name.replace('SM ', 'Sushi Master ').replace('IKURA', 'Ikura').toLowerCase();
             matched = dbRests.find(dr => cleanName.includes(dr.city?.toLowerCase() || 'xxxxx'));
        }
        
        if (matched) {
             await supabase.from('restaurants').update({ iiko_config: { organizationId: org.id } }).eq('id', matched.id);
             matched.mappedOrgId = org.id;
        }
    }
    
    // Refetch mapped
    const { data: activeRests } = await supabase.from('restaurants').select('id, name, iiko_config');
    const validRests = activeRests.filter(r => r.iiko_config && r.iiko_config.organizationId);
    console.log(`📡 Avem ${validRests.length} restaurante mapate perfect.`);

    // 5. Pull sales day by day for the last 3 days
    let totalOrds = 0;
    
    for (const rest of validRests) {
        console.log(`📥 Trag date pt ${rest.name}...`);
        
        for (let pass = 0; pass < 3; pass++) {
            const zi = new Date();
            zi.setDate(zi.getDate() - pass);
            const ziStr = zi.toISOString().split('T')[0];
            const fromStr = ziStr + ' 00:00:00.000';
            const toStr = ziStr + ' 23:59:59.000';
            
            const deliveryRes = await fetch(`${BASE_URL}/deliveries/by_delivery_date_and_status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    organizationIds: [rest.iiko_config.organizationId],
                    deliveryDateFrom: fromStr,
                    deliveryDateTo: toStr
                })
            });
        
        const dData = await deliveryRes.json();
        const orders = dData.orders || [];
        console.log(`➡️  Status: ${deliveryRes.status}, Comenzi gasite brut: ${orders.length}`);
        if (dData.errorDescription) console.log('Eroare iiko:', dData.errorDescription);
        
        const rowsToInsert = [];
        for (const o of orders) {
             const sum = o.sum || o.order?.sum || 0;
             const time = o.creationStatus?.time || o.order?.creationStatus?.time || new Date().toISOString();
             const externalId = o.id || o.order?.id;
             let source = 'iiko';
             const typeName = o.orderType?.name || '';
             if (typeName.toLowerCase().includes('glovo')) source = 'glovo';
             if (typeName.toLowerCase().includes('bolt')) source = 'bolt';
             if (typeName.toLowerCase().includes('wolt')) source = 'wolt';

             rowsToInsert.push({
                 restaurant_id: rest.id,
                 platform: source,
                 order_id: externalId,
                 total_amount: sum,
                 placed_at: time
             })
        }
        
            if (rowsToInsert.length > 0) {
                // chunk upscale
                for (let i = 0; i < rowsToInsert.length; i += 1000) {
                    await supabase.from('platform_sales').upsert(rowsToInsert.slice(i, i+1000), { onConflict: 'order_id' });
                }
                totalOrds += rowsToInsert.length;
                console.log(`✅ [Ziua -${pass}] ${rowsToInsert.length} comenzi inserate.`);
            }
        } // end day loop
    } // end rest loop
    
    console.log(`🎉 GATA! S-au introdus in total ${totalOrds} comenzi in baza de date.`);
}

syncAll().catch(e => console.error(e));
