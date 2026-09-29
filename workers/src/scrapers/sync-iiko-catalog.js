import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const ENVIRONMENTS = [
    {
        name: 'IKURA / SUSHI MASTER HUB',
        url: 'https://api-eu.iiko.services/api/1',
        key: 'a1fe30cdeb934aa0af01b6a35244b7f0', // Master key
        defaultBrand: 'Sushi Master'
    },
    {
        name: 'SMASH ME HUB',
        url: 'https://api-eu.syrve.live/api/1',
        key: '124d0880f4b44717b69ee21d45fc2656', // Smash me key
        defaultBrand: 'Smash Me'
    }
];

async function syncIikoCatalog() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 INIT SYNC NOMENCLATOR IIKO -> SUPABASE...`);
    
    let newCount = 0;
    let updateCount = 0;

    try {
        for (const env of ENVIRONMENTS) {
            console.log(`\n==========================================`);
            console.log(`📡 CONECTARE LA: ${env.name}`);
            console.log(`==========================================`);
            
            // 1. Auth iiko
            console.log('[1/4] Autentificare in Cloud...');
            const resAuth = await fetch(`${env.url}/access_token`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: env.key })
            });
            if (!resAuth.ok) throw new Error(`Eroare la autentificarea ${env.name}`);
            const { token } = await resAuth.json();

            // 2. Fetch first org
            console.log('[2/4] Preluare organizatii...');
            const resOrgs = await fetch(`${env.url}/organizations`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
            });
            const { organizations } = await resOrgs.json();
            if (!organizations || !organizations.length) {
                 console.log('Nu exista organizatii! Sarim peste...');
                 continue;
            }
            
            const allProductsMap = new Map();
            
            // 3. Download Nomenclature
            console.log(`[3/4] Descarcare meniu din ${organizations.length} organizatii pentru a capta toate brandurile...`);
            for(let i=0; i<organizations.length; i++) {
                const org = organizations[i];
                console.log(`  -> Descarcare nomenclature pt ${org.name} (${i+1}/${organizations.length})...`);
                const resMenu = await fetch(`${env.url}/nomenclature`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ organizationId: org.id })
                });
                const menuData = await resMenu.json();
                
                const groupsMap = new Map((menuData.groups || []).map(g => [g.id, g.name]));
                
                const items = (menuData.products || [])
                    .filter(p => p.type && (p.type.toLowerCase() === 'dish' || p.type.toLowerCase() === 'good'));
                    
                for(const p of items) {
                    if(!allProductsMap.has(p.id)) {
                        p.resolvedCategory = groupsMap.get(p.parentGroup) || 'Meniu General';
                        allProductsMap.set(p.id, p);
                    }
                }
            }
            
            const rawProducts = Array.from(allProductsMap.values());
            console.log(`[4/4] S-au gasit ${rawProducts.length} produse unice! Parsare si salvare in Supabase...`);

            for (const p of rawProducts) {
                const category = p.resolvedCategory;
                let computedBrandName = env.defaultBrand; 
                
                const upCat = category.toUpperCase();
                const upName = p.name.toUpperCase();

                // Advanced Matching based on categories/names
                if (env.name === 'IKURA / SUSHI MASTER HUB') {
                    if (upCat.includes('IKURA') || upName.includes('IKURA')) computedBrandName = 'Ikura Sushi';
                    else if (upCat.includes('W LS') || upCat.includes('WE LOVE') || upName.includes('W LS') || upName.includes('WE LOVE') || upName.includes('W LOVE') || upCat.includes('LOVE M')) computedBrandName = 'We Love Sushi';
                } else if (env.name === 'SMASH ME HUB') {
                    computedBrandName = 'Smash Me'; // everything from this API is Smash
                }

                const payload = {
                    iiko_id: p.id,
                    name: p.name,
                    sku: p.code,
                    category,
                    price: p.defaultUnit || p.prices?.[0] ? null : 0,
                    brand_name: computedBrandName,
                    weight: p.weight || null,
                    measure_unit: p.measureUnit || 'kg',
                    image_url: p.imageLinks?.[0] || null,
                    last_synced_at: new Date().toISOString()
                };

                const { data: existing } = await supabase
                    .from('iiko_catalog')
                    .select('id, last_synced_at')
                    .eq('iiko_id', p.id)
                    .single();

                if (existing) {
                    await supabase.from('iiko_catalog').update(payload).eq('iiko_id', p.id);
                    updateCount++;
                } else {
                    await supabase.from('iiko_catalog').insert([payload]);
                    newCount++;
                }
            }
        }

        console.log(`✅ SYNC FINALIZAT! Produse absolute noi: ${newCount} | Produse actualizate (preturi etc): ${updateCount}`);
        
    } catch (err) {
        console.error('❌ EROARE CRITICA:', err.message);
    }
}

syncIikoCatalog();
