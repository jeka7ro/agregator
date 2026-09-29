import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKERS_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(WORKERS_DIR, '..');

dotenv.config({ path: path.join(WORKERS_DIR, '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Map city code to standard city name
const CITY_CODE_TO_NAME = {
    'BCU': 'Bacau',
    'BRL': 'Braila',
    'BRV': 'Brasov',
    'BTO': 'Botosani',
    'BUC': 'Bucuresti',
    'CLJ': 'Cluj-Napoca',
    'CRB': 'Balotesti',
    'CRV': 'Craiova',
    'CTA': 'Constanta',
    'GLT': 'Galati',
    'IAS': 'Iasi',
    'ORD': 'Oradea',
    'PIT': 'Pitesti',
    'PTN': 'Piatra Neamt',
    'SBU': 'Sibiu',
    'SCV': 'Suceava',
    'TGM': 'Targu Mures',
    'TIM': 'Timisoara',
    'TUL': 'Tulcea'
};

const CITY_SLUGS = {
    'Bacau': 'bacau',
    'Braila': 'braila',
    'Brasov': 'brasov',
    'Botosani': 'botosani',
    'Bucuresti': 'bucuresti',
    'Cluj-Napoca': 'cluj-napoca',
    'Balotesti': 'balotesti',
    'Craiova': 'craiova',
    'Constanta': 'constanta',
    'Galati': 'galati',
    'Iasi': 'iasi',
    'Oradea': 'oradea',
    'Pitesti': 'pitesti',
    'Piatra Neamt': 'piatra-neamt',
    'Sibiu': 'sibiu',
    'Suceava': 'suceava',
    'Targu Mures': 'targu-mures',
    'Timisoara': 'timisoara',
    'Tulcea': 'tulcea'
};

// Direct verified Glovo URLs
const DIRECT_GLOVO_URLS = {
    'BRAILA (Roll Master)': 'https://glovoapp.com/ro/ro/braila/stores/sushi-master-brl',
    'BRAILA (Poki Woki)': 'https://glovoapp.com/ro/ro/braila/stores/ikura-sushi-brl'
};

// Direct verified Wolt URLs
const DIRECT_WOLT_URLS = {
    'IASI#1 (Poki Woki)': 'https://wolt.com/ro/rou/iasi/restaurant/poki-woki-iasi-67dad68ddb56261b0e642504',
    'IASI#2 (Poki Woki)': 'https://wolt.com/ro/rou/iasi/restaurant/poki-woki-tudor-67dad68ddb56261b0e64250a',
    'SIBIU (Poki Woki)': 'https://wolt.com/ro/rou/sibiu/restaurant/ikura-sushi-sibiu-67dad68ddb56261b0e642503',
    'TIMISOARA (Poki Woki)': 'https://wolt.com/ro/rou/timisoara/restaurant/poki-woki-timisoara-6a54b66c03a39aad721f93ec',
    'SUCEAVA (Poki Woki)': 'https://wolt.com/ro/rou/suceava/restaurant/poki-woki-suceava-67dad68ddb56261b0e642505',
    'Smash Me Cluj (Smash Me)': 'https://wolt.com/en/rou/restaurant/67dc3f5b2e58c74a8f351224',
    'Smash Me Cluj (Crunch)': 'https://wolt.com/en/rou/restaurant/6a2951eed236e475d034947b',
    'Smash Me Constanta (Smash Me)': 'https://wolt.com/en/rou/restaurant/690088cf9855699872d4fcd1',
    'Smash Me Constanta (Crunch)': 'https://wolt.com/en/rou/restaurant/69f993b1ada408041e3933b8'
};

// Direct verified Bolt URLs
const DIRECT_BOLT_URLS = {
    'IASI#1 (Roll Master)': 'https://food.bolt.eu/ro-ro/463-iasi/p/31986-sushi-master-tudor-vladimirescu/',
    'IASI#2 (Roll Master)': 'https://food.bolt.eu/ro-ro/463-iasi/p/31986-sushi-master-tudor-vladimirescu/',
    'Sushi Master Iasi': 'https://food.bolt.eu/ro-ro/463-iasi/p/31986-sushi-master-tudor-vladimirescu/',
    'TIMISOARA (Roll Master)': 'https://food.bolt.eu/ro-ro/454-timisoara/p/98954-sushi-master-sud-plaza/',
    'Sushi Master Timisoara': 'https://food.bolt.eu/ro-ro/454-timisoara/p/98954-sushi-master-sud-plaza/',
    'BUC UNIRII (Roll Master)': 'https://food.bolt.eu/ro-ro/325-bucharest/p/21221-sushi-master-lujerului/',
    'BUC CORA (Roll Master)': 'https://food.bolt.eu/ro-ro/325-bucharest/p/21221-sushi-master-lujerului/',
    'BUC CEAIKOVSKI (Roll Master)': 'https://food.bolt.eu/ro-ro/325-bucharest/p/21221-sushi-master-lujerului/',
    'BUC TITAN (Roll Master)': 'https://food.bolt.eu/ro-ro/325-bucharest/p/21221-sushi-master-lujerului/',
    'Sushi Master Bucharest': 'https://food.bolt.eu/ro-ro/325-bucharest/p/21221-sushi-master-lujerului/',
    'CRAIOVA (Poki Woki)': 'https://food.bolt.eu/ro-ro/1052-craiova/p/93973-ikura-sushi-craiova',
    'Ikura Sushi Craiova': 'https://food.bolt.eu/ro-ro/1052-craiova/p/93973-ikura-sushi-craiova',
    'CLUJ (Poki Woki)': 'https://food.bolt.eu/ro-ro/92-cluj-napoca/p/93974-ikura-sushi-cluj',
    'Ikura Sushi Cluj-Napoca': 'https://food.bolt.eu/ro-ro/92-cluj-napoca/p/93974-ikura-sushi-cluj',
    'BRAILA (Roll Master)': 'https://food.bolt.eu/ro-ro/1051-braila/p/178376-sushi-master-braila/',
    'BRAILA (Poki Woki)': 'https://food.bolt.eu/ro-ro/1051-braila/p/178376-sushi-master-braila/',
    'Sushi Master Braila': 'https://food.bolt.eu/ro-ro/1051-braila/p/178376-sushi-master-braila/',
    'GALATI (Roll Master)': 'https://food.bolt.eu/ro-ro/14-galati/p/21217-sushi-master-galati/',
    'GALATI (Poki Woki)': 'https://food.bolt.eu/ro-ro/14-galati/p/21217-sushi-master-galati/',
    'Sushi Master Galati': 'https://food.bolt.eu/ro-ro/14-galati/p/21217-sushi-master-galati/',
    'CONSTANTA (Roll Master)': 'https://food.bolt.eu/ro-ro/464-constan%C8%9Ba/p/87130-sushi-master-tomis/',
    'CONSTANTA (Poki Woki)': 'https://food.bolt.eu/ro-ro/464-constan%C8%9Ba/p/87130-sushi-master-tomis/',
    'Sushi Master Constanta': 'https://food.bolt.eu/ro-ro/464-constan%C8%9Ba/p/87130-sushi-master-tomis/',
    'Smash Me Constanta (Smash Me)': 'https://food.bolt.eu/ro-ro/462-constanta/p/172256-smash-me-city-park/',
    'Smash Me Constanta': 'https://food.bolt.eu/ro-ro/462-constanta/p/172256-smash-me-city-park/'
};

function normalizeBrand(name) {
    const l = name.toLowerCase();
    if (l.includes('love sushi')) return 'Love Sushi';
    if (l.includes('poki woki') || l.includes('poki-woki') || l.includes('ikura')) return 'Poki Woki';
    if (l.includes('smash me')) return 'Smash Me';
    if (l.includes('crunch')) return 'Crunch';
    return 'Roll Master';
}

function cleanCity(city) {
    if (!city) return 'Bucharest';
    const c = city.trim();
    if (c.toUpperCase().includes('BUC')) return 'Bucuresti';
    if (c.toUpperCase().includes('CLUJ')) return 'Cluj-Napoca';
    if (c.toUpperCase().includes('TIMISOARA')) return 'Timisoara';
    if (c.toUpperCase().includes('IASI')) return 'Iasi';
    if (c.toUpperCase().includes('CONSTANTA')) return 'Constanta';
    if (c.toUpperCase().includes('BRASOV')) return 'Brasov';
    if (c.toUpperCase().includes('GALATI')) return 'Galati';
    if (c.toUpperCase().includes('SIBIU')) return 'Sibiu';
    if (c.toUpperCase().includes('PITESTI')) return 'Pitesti';
    if (c.toUpperCase().includes('BACAU')) return 'Bacau';
    if (c.toUpperCase().includes('SUCEAVA')) return 'Suceava';
    if (c.toUpperCase().includes('MURES')) return 'Targu Mures';
    if (c.toUpperCase().includes('BRAILA')) return 'Braila';
    if (c.toUpperCase().includes('CRAIOVA')) return 'Craiova';
    if (c.toUpperCase().includes('ORADEA')) return 'Oradea';
    if (c.toUpperCase().includes('NEAMT')) return 'Piatra Neamt';
    if (c.toUpperCase().includes('TULCEA')) return 'Tulcea';
    if (c.toUpperCase().includes('BOTOSANI')) return 'Botosani';
    if (c.toUpperCase().includes('BALOTESTI')) return 'Balotesti';
    return c;
}

async function run() {
    console.log('🚀 Loading restaurants from Supabase...');
    const { data: restaurants, error } = await supabase.from('restaurants').select('*');
    if (error) {
        console.error('Supabase error:', error);
        return;
    }
    console.log(`Found ${restaurants.length} total restaurants.`);

    // Parse Wolt CSV
    const woltCsvPath = path.join(ROOT_DIR, 'venue_ids_branduri_tip_livrare - Untitled.csv');
    const woltVenues = [];
    if (fs.existsSync(woltCsvPath)) {
        const content = fs.readFileSync(woltCsvPath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const header = lines[0].split(',');
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length >= 4) {
                woltVenues.push({
                    brand: cols[0]?.trim(),
                    venueName: cols[1]?.trim(),
                    city: cols[2]?.trim(),
                    venueId: cols[3]?.trim()
                });
            }
        }
    }
    console.log(`Loaded ${woltVenues.length} Wolt venues from CSV.`);

    // Parse Glovo ODS
    const odsPath = path.join(ROOT_DIR, 'Roll Master Location (1).ods');
    let glovoStores = [];
    if (fs.existsSync(odsPath)) {
        const wb = xlsx.readFile(odsPath);
        glovoStores = xlsx.utils.sheet_to_json(wb.Sheets['Foaia1']);
    }
    console.log(`Loaded ${glovoStores.length} Glovo store IDs from ODS.`);

    let updatedCount = 0;

    for (const r of restaurants) {
        const updates = {};
        const brand = normalizeBrand(r.name);
        const city = cleanCity(r.city || r.name);

        // 1. GLOVO
        if (!r.glovo_url) {
            if (DIRECT_GLOVO_URLS[r.name]) {
                updates.glovo_url = DIRECT_GLOVO_URLS[r.name];
            } else {
                // Search in Glovo ODS
                const match = glovoStores.find(g => {
                    const gCity = CITY_CODE_TO_NAME[g['City Code']] || g['City Code'];
                    const gBrand = normalizeBrand(g['Store Name'] || '');
                    return gCity?.toLowerCase() === city.toLowerCase() && gBrand.toLowerCase() === brand.toLowerCase();
                });
                if (match && match['Store ID']) {
                    updates.glovo_url = `https://glovoapp.com/ro/ro/store/${match['Store ID']}`;
                } else {
                    // Fallback to city store search
                    const citySlug = CITY_SLUGS[city] || city.toLowerCase().replace(/\s+/g, '-');
                    const brandSearch = brand.toLowerCase().replace(/\s+/g, '-');
                    updates.glovo_url = `https://glovoapp.com/ro/ro/${citySlug}/search/?q=${encodeURIComponent(brand)}`;
                }
            }
        }

        // 2. WOLT
        if (DIRECT_WOLT_URLS[r.name]) {
            updates.wolt_url = DIRECT_WOLT_URLS[r.name];
        } else if (!r.wolt_url) {
            // Find in Wolt CSV
            const match = woltVenues.find(w => {
                const wBrand = normalizeBrand(w.brand || '');
                const wCity = cleanCity(w.city || '');
                return wCity.toLowerCase() === city.toLowerCase() && wBrand.toLowerCase() === brand.toLowerCase();
            });
            if (match && match.venueId && match.venueId !== '-') {
                updates.wolt_url = `https://wolt.com/en/rou/restaurant/${match.venueId}`;
            } else {
                // If Wolt doesn't have venue in this city (like Tulcea), direct to city search
                const citySlug = CITY_SLUGS[city] || city.toLowerCase().replace(/\s+/g, '-');
                updates.wolt_url = `https://wolt.com/ro/rou/${citySlug}/search?q=${encodeURIComponent(brand)}`;
            }
        }

        // 3. BOLT FOOD
        if (DIRECT_BOLT_URLS[r.name]) {
            updates.bolt_url = DIRECT_BOLT_URLS[r.name];
        } else if (!r.bolt_url) {
            // Generate direct functional search URL for Bolt
            updates.bolt_url = `https://food.bolt.eu/ro-RO/search?q=${encodeURIComponent(brand + ' ' + city)}`;
        }

        if (Object.keys(updates).length > 0) {
            const { error: updErr } = await supabase.from('restaurants').update(updates).eq('id', r.id);
            if (updErr) {
                console.error(`Error updating ${r.name}:`, updErr.message);
            } else {
                console.log(`✅ Updated ${r.name} (${city}):`, Object.keys(updates).join(', '));
                updatedCount++;
            }
        }
    }

    console.log(`\n🎉 DONE! Successfully updated ${updatedCount} restaurants in Supabase.`);
}

run();
