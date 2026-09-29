import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_KEYS = [
    'a1fe30cdeb934aa0af01b6a35244b7f0',
    '124d0880f4b44717b69ee21d45fc2656',
    '56597d13165c49c49c10e351b5eac617',
    '78a2206d3b9c4e93b9b5a5ee774f69aa'
];

// Mapping of Virtual Brand Name to Iiko Category Folders (Mape principale)
const VIRTUAL_BRANDS = [
    { brandName: 'We Love Sushi', categories: ['WLS', 'Love Sushi', 'WE LOVE SUSHI', 'We Love Sushi'] },
    { brandName: 'Poki Woki', categories: ['POKI WOKI', 'Poki Woki Platforme', 'Poki-Woki'] },
    { brandName: 'Smash Me', categories: ['Smash Me Kiosk', 'Smash Me', 'Smash ME', 'SMASH ME', 'MENIU SMASH'] },
    { brandName: 'Roll Master', categories: ['Roll Master', 'ROLL MASTER', 'RollMaster', 'rollmaster'] },
    { brandName: 'Crunch', categories: ['Crunch', 'CRUNCH'] },
    { brandName: 'Sushi Master', categories: ['SUSHI MASTER', 'Sushi Master'] },
    { brandName: 'Ikura Sushi', categories: ['Ikura', 'IKURA', 'Ikura Sushi'] }
];

async function migrate() {
    console.log("🚀 Starting SMART Virtual Brands Migration...");
    
    // Deactivate old physical restaurants to transition to virtual architecture
    console.log("Deactivating old restaurants...");
    await supabase.from('restaurants').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data: brands, error: brandErr } = await supabase.from('brands').select('id, name');
    if (brandErr) throw brandErr;
    
    const brandMap = {};
    for (const b of brands) {
        brandMap[b.name.toLowerCase()] = b.id;
    }

    const createdRestaurants = [];
    const allOrgs = new Map();
    const allTokens = {};
    
    console.log("Fetching organizations and API tokens...");
    for (const key of API_KEYS) {
        try {
            const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiLogin: key }) });
            const token = (await resAuth.json()).token;
            if (!token) continue;
            allTokens[key] = token;
            
            const resOrgs = await fetch('https://api-eu.syrve.live/api/1/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ returnAdditionalInfo: true }) });
            const data = await resOrgs.json();
            for (const org of (data.organizations || [])) {
                if (!allOrgs.has(org.id)) {
                    allOrgs.set(org.id, { ...org, apiKey: key });
                }
            }
        } catch (e) { console.log(`Skipping key ${key}: ${e.message}`); }
    }
    
    console.log(`Found ${allOrgs.size} unique physical organizations.`);
    
    for (const [orgId, org] of allOrgs.entries()) {
        const cityMatch = org.name.match(/(BUC\s+\w+|IASI(?:#\d+)?|CLUJ|CONSTANTA|TULCEA|TARGU MURES|BACAU|TIMISOARA|PITESTI|ORADEA|BALOTESTI|SUCEAVA|GALATI|CRAIOVA|BRASOV|BRAILA|BOTOSANI|PIATRA NEAMT)/i);
        const city = cityMatch ? cityMatch[1].toUpperCase() : org.name;
        
        let topGroups = [];
        let allProducts = [];
        const token = allTokens[org.apiKey];
        if (token) {
            try {
                const nRes = await fetch('https://api-eu.syrve.live/api/1/nomenclature', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ organizationId: orgId }) });
                if (nRes.ok) {
                    const nData = await nRes.json();
                    topGroups = (nData.groups || []).filter(g => !g.parentGroup).map(g => g.name.toLowerCase().trim());
                    allProducts = nData.products || [];
                }
            } catch(e) {}
        }
        
        console.log(`\nLocation: ${org.name} | Active Groups: ${topGroups.join(', ')}`);
        
        for (const vb of VIRTUAL_BRANDS) {
            // Check if this location ACTUALLY sells this brand!
            const brandExistsInOrg = vb.categories.some(c => {
                const cLower = c.toLowerCase().trim();
                if (topGroups.some(g => g === cLower || g.includes(cLower))) return true;
                if (cLower === 'roll master' || cLower === 'rollmaster' || cLower === 'ikura' || cLower === 'ikura sushi') {
                    return allProducts.some(p => p.name.toLowerCase().includes(cLower));
                }
                return false;
            });
            
            if (!brandExistsInOrg) {
                console.log(`  - Skipping '${vb.brandName}' (Not found in catalog)`);
                continue;
            }
            
            const brandId = brandMap[vb.brandName.toLowerCase()];
            if (!brandId) continue;
            
            const resName = `${org.name} (${vb.brandName})`;
            
            const iikoConfig = {
                organizationId: org.id,
                api_login: org.apiKey,
                categories: vb.categories
            };
            
            createdRestaurants.push({
                name: resName,
                city: city,
                brand_id: brandId,
                iiko_restaurant_id: org.id,
                iiko_config: iikoConfig,
                is_active: true
            });
            
            console.log(`  + ADDING Virtual Restaurant: ${resName}`);
        }
    }
    
    console.log(`\nInserting ${createdRestaurants.length} Virtual Restaurants...`);
    for (let i = 0; i < createdRestaurants.length; i += 50) {
        const chunk = createdRestaurants.slice(i, i + 50);
        const { error: insErr } = await supabase.from('restaurants').insert(chunk);
        if (insErr) console.error("Error inserting chunk:", insErr.message);
    }
    
    console.log("✅ Smart Migration complete!");
}

migrate().catch(console.error);
