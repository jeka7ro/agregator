import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
const API_KEY = process.env.IIKO_API_KEY || 'a1fe30cdeb934aa0af01b6a35244b7f0';

async function fixBrands() {
    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiLogin: API_KEY }) });
    const token = (await resAuth.json()).token;

    const resOrgs = await fetch('https://api-eu.syrve.live/api/1/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ returnAdditionalInfo: true }) });
    const iikoOrgs = (await resOrgs.json()).organizations || [];
    
    const { data: dbRest } = await supabase.from('restaurants').select('id, name, iiko_config');
    const { data: brands } = await supabase.from('brands').select('id, name');
    
    const smBrand = brands.find(b => b.name === 'Sushi Master').id;
    const ikuraBrand = brands.find(b => b.name === 'Ikura Sushi').id;

    for (const org of iikoOrgs) {
        const existing = dbRest.find(r => r.name.toLowerCase() === org.name.toLowerCase());
        if (existing) {
            if (!existing.iiko_config?.organizationId) {
                console.log(`Fixing organizationId for ${org.name}`);
                const newConfig = { ...existing.iiko_config, organizationId: org.id };
                await supabase.from('restaurants').update({ iiko_config: newConfig }).eq('id', existing.id);
            }
        } else {
            console.log(`Inserting NEW restaurant: ${org.name}`);
            const brandId = org.name.toLowerCase().includes('ikura') ? ikuraBrand : smBrand;
            await supabase.from('restaurants').insert({
                name: org.name,
                brand_id: brandId,
                is_active: true,
                iiko_config: { organizationId: org.id, excluded_product_name_patterns: [] }
            });
        }
    }
    console.log("DONE FIXING!");
}
fixBrands().catch(console.error);
