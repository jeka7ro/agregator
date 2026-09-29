import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load variables from .env.local
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.IIKO_API_KEY || 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.syrve.live/api/1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncIikoSales() {
    console.log("🔥 Pornire SINCRONIZARE iiko API -> Supabase...");

    // 1. Get Token
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const authData = await resAuth.json();
    if (authData.errorDescription) {
        throw new Error(`Auth Error: ${authData.errorDescription}`);
    }
    const token = authData.token;
    console.log("✅ Autentificat cu succes pe iiko!");

    // 2. Extragem restaurantele din baza noastra (Supabase) ca sa stim ID-urile
    const { data: restaurants, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name, iiko_config')
        .eq('is_active', true);
        
    if (restErr) throw new Error("Eroare Supabase: " + restErr.message);

    const validRestaurants = restaurants.filter(r => r.iiko_config && (r.iiko_config.organizationId || r.iiko_config.organization_id));
    console.log(`📡 Avem ${validRestaurants.length} restaurante mapate cu iiko in baza noastra.`);

    if (validRestaurants.length === 0) {
        console.log("❌ Nu ai adaugat 'organizationId' in coloana 'iiko_config' pentru restaurantele din baza!");
        console.log("Vom face noi o mapare de proba, extragand direct de la iiko prima locatie:");
        
        // Luam organizatiile de la iiko
        const orgRes = await fetch(`${BASE_URL}/organizations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ })
        });
        const oData = await orgRes.json();
        const firstId = oData.organizations[0]?.id;
        
        if (!firstId) {
             console.log("Nu am gasit locatii..."); return;
        }
        
        // Salvam ca proba pe ultimul restaurant din Supabase daca exista
        if (restaurants.length > 0) {
             console.log(`🔗 Mapez automat ${restaurants[0].name} cu ID-ul iiko: ${firstId}...`);
             validRestaurants.push({ ...restaurants[0], iiko_config: { organizationId: firstId } });
        }
    }

    // Asteptam date pentru azi
    const azi = new Date().toISOString().split('T')[0]; // ex: 2026-04-01
    
    // Fetch nomenclature for each unique organization
    const orgProductCategoryMap = {};
    for (const r of validRestaurants) {
        const orgId = r.iiko_config.organizationId || r.iiko_config.organization_id;
        const apiKey = r.iiko_config.api_login || API_KEY;
        if (orgId && !orgProductCategoryMap[orgId]) {
            try {
                // We need token per key, but for simplicity we'll just use the main token if no specific key, or fetch a new one
                let currentToken = token;
                if (r.iiko_config.api_login && r.iiko_config.api_login !== API_KEY) {
                    const rAuth = await fetch(`${BASE_URL}/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiLogin: apiKey }) });
                    currentToken = (await rAuth.json()).token;
                }
                const nRes = await fetch(`${BASE_URL}/nomenclature`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }, body: JSON.stringify({ organizationId: orgId }) });
                if (nRes.ok) {
                    const nData = await nRes.json();
                    const groupMap = {};
                    (nData.groups || []).forEach(g => groupMap[g.id] = g);
                    const getTopLevelGroup = (groupId) => {
                        let curr = groupMap[groupId];
                        while (curr && curr.parentGroup) curr = groupMap[curr.parentGroup];
                        return curr ? curr.name : '';
                    };
                    const productMap = {};
                    (nData.products || []).forEach(p => productMap[p.id] = getTopLevelGroup(p.parentGroup));
                    orgProductCategoryMap[orgId] = productMap;
                }
            } catch(e) { console.error("Error fetching nomenclature for org", orgId, e.message); }
        }
    }
    
    // 3. Extragem vânzările pt fiecare
    for (const rest of validRestaurants) {
        const orgId = rest.iiko_config.organizationId || rest.iiko_config.organization_id;
        const filterCategories = rest.iiko_config.categories || null;
        let apiKey = rest.iiko_config.api_login || API_KEY;
        let currentToken = token;
        if (apiKey !== API_KEY) {
             const rAuth = await fetch(`${BASE_URL}/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiLogin: apiKey }) });
             currentToken = (await rAuth.json()).token;
        }

        console.log(`\n📥 Descarcam si trimitem comenzi iiko pentru ${rest.name}...`);
        
        // Preluam deliveries
        const deliveryRes = await fetch(`${BASE_URL}/deliveries/by_delivery_date_and_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
            body: JSON.stringify({
                organizationIds: [orgId],
                deliveryDateFrom: `${azi} 00:00:00.000`,
                deliveryDateTo: `${azi} 23:59:59.000`,
                statuses: ["Closed"]
            })
        });
        
        const dData = await deliveryRes.json();
        const orders = dData.orders || [];
        console.log(`📦 Am gasit ${orders.length} comenzi pentru azi din iiko.`);
        
        let inserted = 0;
        for (const o of orders) {
             let sum = 0;
             if (o.order?.items) {
                 for (const it of o.order.items) {
                     if (it.type === 'Product' && it.product) {
                         const pName = (it.product.name || '').toLowerCase();
                         const prodCategory = (orgProductCategoryMap[orgId]?.[it.product.id] || '').toUpperCase();
                         if (filterCategories && filterCategories.length > 0) {
                             const matchesCategory = filterCategories.some(c => prodCategory.includes(c.toUpperCase()));
                             const fallbackMatch = filterCategories.some(c => pName.includes(c.toLowerCase()));
                             if (!matchesCategory && !fallbackMatch) continue;
                         }
                         sum += (it.resultSum || it.price || 0);
                     }
                 }
             } else {
                 // Fallback if no items array (unlikely for closed deliveries)
                 sum = o.sum || o.order?.sum || 0;
             }
             
             if (sum === 0 && filterCategories && filterCategories.length > 0) continue; // Skip if order has no items for this brand

             const time = o.creationStatus?.time || o.order?.creationStatus?.time || new Date().toISOString();
             const baseId = o.id || o.order?.id;
             const externalId = baseId + '_' + rest.id; // Make order ID unique per virtual brand
             
             let source = 'iiko';
             const orderTypeName = (o.orderType?.name || o.order?.orderType?.name || '');
             if (orderTypeName.includes('Glovo')) source = 'glovo';
             else if (orderTypeName.includes('Bolt')) source = 'bolt';
             else if (orderTypeName.includes('Wolt')) source = 'wolt';

             const { error: insErr } = await supabase
                 .from('platform_sales')
                 .upsert({
                     restaurant_id: rest.id,
                     platform: source,
                     order_id: externalId,
                     total_amount: sum,
                     placed_at: time
                 }, { onConflict: 'order_id' }) // daca tabela permite upser pe identificatorul de comanda

             if (!insErr) inserted++;
        }
        console.log(`✅ Am integrat cu succes ${inserted} comenzi in Heatmap-ul tau (Tabelul 'platform_sales')!`);
    }
}

syncIikoSales().catch(err => console.error("Eroare Sincronizare:", err));
