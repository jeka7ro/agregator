import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix incarcare .env local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.IIKO_API_KEY || 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.syrve.live/api/1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkBrands() {
    console.log("1. Autentificare pe iiko...");
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const authData = await resAuth.json();
    if (!authData.token) throw new Error("Nu m-am putut autentifica in Iiko: " + JSON.stringify(authData));
    const token = authData.token;

    console.log("2. Preluare organizatii din iiko (API live)...");
    const resOrgs = await fetch(`${BASE_URL}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ returnAdditionalInfo: true })
    });
    const iikoOrgs = (await resOrgs.json()).organizations || [];
    console.log(`-> Gasite ${iikoOrgs.length} restaurante/organizatii in iiko.\n`);

    console.log("3. Preluare restaurante curente din Supabase (baza de date)...");
    const { data: dbRest } = await supabase.from('restaurants').select('id, name, is_active, iiko_config');
    const activeDbOrgs = dbRest.filter(r => r.is_active && r.iiko_config?.organizationId).map(r => r.iiko_config.organizationId);
    
    console.log("\n==== RAPORT COMPARATIV IIKO vs SUPABASE ====\n");
    
    console.log("🟢 1. RESTAURANTE NOI IN IIKO (Nu sunt in baza noastra sau sunt inactive):");
    const newOrgs = iikoOrgs.filter(org => !activeDbOrgs.includes(org.id));
    if (newOrgs.length === 0) console.log("   Nu exista nimic nou.");
    newOrgs.forEach(org => console.log(`   - [NOU] ${org.name} (ID: ${org.id})`));
    
    console.log("\n🔴 2. RESTAURANTE CARE NU MAI EXISTA IN IIKO (Dar sunt inca active in baza noastra):");
    const iikoIds = iikoOrgs.map(o => o.id);
    const missingOrgs = dbRest.filter(r => r.is_active && r.iiko_config?.organizationId && !iikoIds.includes(r.iiko_config.organizationId));
    if (missingOrgs.length === 0) console.log("   Nu exista restaurante lipsa.");
    missingOrgs.forEach(r => console.log(`   - [LIPSA/INCHIS] ${r.name} (iiko_id vechi: ${r.iiko_config.organizationId})`));
    
    console.log(`\n✅ 3. RESTAURANTE OK: ${iikoOrgs.filter(org => activeDbOrgs.includes(org.id)).length} bucati gasite in ambele parti.`);
    console.log("\n==========================================\n");
}

checkBrands().catch(console.error);
