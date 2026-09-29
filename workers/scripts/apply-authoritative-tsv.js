import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKERS_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(WORKERS_DIR, '..');

dotenv.config({ path: path.join(WORKERS_DIR, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log('🚀 Reading authoritative store IDs TSV...');
    const tsvPath = path.join(ROOT_DIR, 'data', 'authoritative_store_ids.tsv');
    const tsvContent = fs.readFileSync(tsvPath, 'utf8');
    const lines = tsvContent.split('\n').filter(Boolean);
    const headers = lines[0].split('\t').map(h => h.trim());
    
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        const rec = {};
        headers.forEach((h, idx) => rec[h] = (parts[idx] || '').trim());
        records.push(rec);
    }
    console.log(`Loaded ${records.length} authoritative records.`);

    console.log('Fetching restaurants from Supabase...');
    const { data: dbRests, error } = await supabase.from('restaurants').select('*');
    if (error) {
        console.error('Supabase error:', error);
        return;
    }
    console.log(`Fetched ${dbRests.length} restaurants from DB.`);

    let updatedCount = 0;

    for (const r of dbRests) {
        const rNameLower = r.name.toLowerCase();
        const rCityLower = (r.city || '').toLowerCase();

        let brand = 'Roll Master';
        if (rNameLower.includes('poki woki') || rNameLower.includes('poki-woki') || rNameLower.includes('ikura')) brand = 'Poki-Woki';
        else if (rNameLower.includes('love sushi')) brand = 'Love Sushi';
        else if (rNameLower.includes('smash me')) brand = 'Smash Me';
        else if (rNameLower.includes('crunch')) brand = 'Crunch';

        const match = records.find(rec => {
            if (rec['Store Name'] !== brand && !(brand === 'Crunch' && rec['Store Name'] === 'Smash Me')) return false;
            const cCode = rec['City Code'].toUpperCase();
            const addr = rec['Address'].toLowerCase();

            if (cCode === 'BUC') {
                if (!rNameLower.includes('buc') && !rCityLower.includes('buc')) return false;
                if (rNameLower.includes('unirii') || rNameLower.includes('halelor')) return addr.includes('halelor');
                if (rNameLower.includes('titan')) return addr.includes('1 decembrie');
                if (rNameLower.includes('ceaikovski')) return addr.includes('ceaikovski');
                if (rNameLower.includes('cora') || rNameLower.includes('lujerului')) return addr.includes('iuliu maniu');
                return true;
            }
            if (cCode === 'IAS') {
                if (!rNameLower.includes('iasi') && !rCityLower.includes('iasi')) return false;
                if (rNameLower.includes('iasi#1') || rNameLower.includes('voievozilor')) return addr.includes('voievozilor');
                if (rNameLower.includes('iasi#2') || rNameLower.includes('tudor')) return addr.includes('tudor');
                return true;
            }
            if (cCode === 'CLJ') return rNameLower.includes('cluj') || rCityLower.includes('cluj');
            if (cCode === 'CTA') return rNameLower.includes('constanta') || rCityLower.includes('constanta');
            if (cCode === 'TIM') return rNameLower.includes('timisoara') || rCityLower.includes('timisoara');
            if (cCode === 'ORD') return rNameLower.includes('oradea') || rCityLower.includes('oradea');

            const cityMap = {
                'BCU': 'bacau', 'BRL': 'braila', 'BRV': 'brasov', 'BTO': 'botosani',
                'CRB': 'balotesti', 'CRV': 'craiova', 'GLT': 'galati', 'PIT': 'pitesti',
                'PTN': 'piatra', 'SBU': 'sibiu', 'SCV': 'suceava', 'TGM': 'mures', 'TUL': 'tulcea'
            };
            const expected = cityMap[cCode];
            return expected && (rNameLower.includes(expected) || rCityLower.includes(expected));
        });

        if (!match) continue;

        const updateData = {};

        // 1. Bolt URL
        const boltId = match['BOLT ID'];
        if (boltId && boltId !== '-') {
            updateData.bolt_url = `https://food.bolt.eu/ro-ro/store/${boltId}/`;
        }

        // 2. Wolt URL
        const woltId = match['WOLT ID'];
        if (woltId && woltId !== '-') {
            updateData.wolt_url = `https://wolt.com/en/rou/restaurant/${woltId}`;
        }

        // 3. Glovo URL
        const glovoId = match['GLOVO Store ID'];
        if (glovoId && glovoId !== '-') {
            // If current URL is already a functional /stores/ slug, we can keep it or use the store ID
            if (!r.glovo_url || !r.glovo_url.includes('/stores/')) {
                updateData.glovo_url = `https://glovoapp.com/ro/ro/store/${glovoId}`;
            }
        }

        // 4. Physical Address
        if (match['Address']) {
            updateData.address = match['Address'];
        }

        if (Object.keys(updateData).length > 0) {
            const { error: updErr } = await supabase.from('restaurants').update(updateData).eq('id', r.id);
            if (updErr) {
                console.error(`Error updating ${r.name}:`, updErr.message);
            } else {
                console.log(`✅ [${match['City Code']} - ${match['Store Name']}] Updated ${r.name}: Bolt: ${boltId || '-'} | Wolt: ${woltId || '-'} | Glovo: ${glovoId || '-'}`);
                updatedCount++;
            }
        }
    }

    console.log(`\n🎉 DONE! Sincronizat cu succes ${updatedCount} restaurante din baza de date.`);
}

run().catch(console.error);
