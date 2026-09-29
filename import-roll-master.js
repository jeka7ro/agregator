import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = '/Users/eugeniucazmal/Downloads/dev_office/agregattor 2.0 (july 2026)';
const CSV_PATH = '/tmp/roll_master.csv';

dotenv.config({ path: path.join(PROJECT_DIR, 'workers', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

async function run() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error('CSV not found at', CSV_PATH);
        return;
    }

    const content = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    let updatedCount = 0;

    for (const record of records) {
        const cityCode = record['City Code']?.trim();
        const address = record['Address']?.trim();
        const glovoId = record['GLOVO Store ID']?.trim();
        const woltId = record['WOLT ID']?.trim();
        const boltId = record['BOLT ID']?.trim();

        if (!cityCode || (!glovoId && !woltId && !boltId)) continue;

        const updateData = {};
        if (glovoId && glovoId !== '-') updateData.glovo_url = `https://glovoapp.com/ro/ro/store/${glovoId}`;
        if (woltId && woltId !== '-') updateData.wolt_url = `https://wolt.com/en/rou/restaurant/${woltId}`;
        if (boltId && boltId !== '-') updateData.bolt_url = `https://food.bolt.eu/ro-ro/store/${boltId}/`;

        if (Object.keys(updateData).length === 0) continue;

        // Try to match by cityCode string like "BUC" in the name
        let { data: rests } = await supabase
            .from('restaurants')
            .select('id, name')
            .ilike('name', `%Love Sushi%`)
            .ilike('name', `%${cityCode}%`);

        if (rests && rests.length > 0) {
            // If multiple matches (like in BUC), we try to match by address keywords if possible, 
            // or if it's the exact same GLOVO ID for all BUC, we just update all of them!
            // Wait, for Wolt and Bolt they might be different IDs for different addresses?
            // Let's check if Bolt ID is the same for all BUC in the CSV:
            // BUC,Love Sushi,426935,"Strada Halelor",...,8T5Mh8r1qV
            // BUC,Love Sushi,426935,"Bulevardul 1 Decembrie",...,n3sqlgXBO5
            // Ah! Bolt IDs are different for different addresses!
            // So we MUST match by address!
            
            // Simple address match: extract street name
            const firstWord = address.split(' ')[1]; // "Strada Halelor" -> "Halelor"
            let matchedRest = null;
            
            if (rests.length === 1) {
                matchedRest = rests[0];
            } else {
                for (const r of rests) {
                    if (r.name.toLowerCase().includes(firstWord.toLowerCase())) {
                        matchedRest = r;
                        break;
                    }
                }
                // manual fallbacks for BUC
                if (!matchedRest) {
                    if (address.includes('Halelor')) matchedRest = rests.find(r => r.name.includes('UNIRII'));
                    if (address.includes('1 Decembrie')) matchedRest = rests.find(r => r.name.includes('TITAN'));
                    if (address.includes('Ceaikovski')) matchedRest = rests.find(r => r.name.includes('CEAIKOVSKI'));
                    if (address.includes('Iuliu Maniu')) matchedRest = rests.find(r => r.name.includes('CORA'));
                }
            }

            if (matchedRest) {
                await supabase.from('restaurants').update(updateData).eq('id', matchedRest.id);
                console.log(`✅ Matched: ${address} -> ${matchedRest.name}`);
                updatedCount++;
            } else {
                console.log(`⚠️ Unmatched address for ${cityCode}: ${address}`);
            }
        } else {
            console.log(`⚠️ No restaurant found for city code ${cityCode}`);
        }
    }
    console.log(`Done! Updated ${updatedCount} restaurants.`);
}

run().catch(console.error);
