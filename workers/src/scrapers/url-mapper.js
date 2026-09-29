import fetch from 'node-fetch';
import { supabase } from '../services/supabase.js';

const CITY_MAPPINGS = [
    { match: 'BUC', glovo: 'bucuresti', wolt: 'bucharest' },
    { match: 'IASI', glovo: 'iasi', wolt: 'iasi' },
    { match: 'SIBIU', glovo: 'sibiu', wolt: 'sibiu' },
    { match: 'CONSTANTA', glovo: 'constanta', wolt: 'constanta' },
    { match: 'CLUJ', glovo: 'cluj-napoca', wolt: 'cluj-napoca' },
    { match: 'TIMISOARA', glovo: 'timisoara', wolt: 'timisoara' },
    { match: 'BRASOV', glovo: 'brasov', wolt: 'brasov' },
    { match: 'GALATI', glovo: 'galati', wolt: 'galati' },
    { match: 'PITESTI', glovo: 'pitesti', wolt: 'pitesti' },
    { match: 'PLOIESTI', glovo: 'ploiesti', wolt: 'ploiesti' },
    { match: 'BACAU', glovo: 'bacau', wolt: 'bacau' },
    { match: 'SUCEAVA', glovo: 'suceava', wolt: 'suceava' },
    { match: 'MURES', glovo: 'targu-mures', wolt: 'targu-mures' },
    { match: 'BRAILA', glovo: 'braila', wolt: 'braila' },
    { match: 'BAIA', glovo: 'baia-mare', wolt: 'baia-mare' },
    { match: 'CRAIOVA', glovo: 'craiova', wolt: 'craiova' },
    { match: 'ORADEA', glovo: 'oradea', wolt: 'oradea' },
    { match: 'ARAD', glovo: 'arad', wolt: 'arad' },
];

function slugify(text) {
    return text.toLowerCase()
        .replace(/[ăâ]/g, 'a')
        .replace(/[îâ]/g, 'i')
        .replace(/[șş]/g, 's')
        .replace(/[țţ]/g, 't')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function checkUrl(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        return res.status < 400;
    } catch {
        return false;
    }
}

async function run() {
    console.log("🚀 Starting Automatic URL Mapper...");
    
    const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, name, city')
        .eq('is_active', true);

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    console.log(`Found ${restaurants.length} active restaurants to map.`);

    for (const rest of restaurants) {
        console.log(`\nMapping: ${rest.name} (${rest.city})`);
        
        // Extract brand name from parenthesis: "SM BUC UNIRII (We Love Sushi)" -> "We Love Sushi"
        const brandMatch = rest.name.match(/\((.*?)\)/);
        const brandName = brandMatch ? brandMatch[1] : rest.name;
        const brandSlug = slugify(brandName);

        // Find city mappings
        const upperCity = rest.city.toUpperCase();
        const mapping = CITY_MAPPINGS.find(m => upperCity.includes(m.match)) || { glovo: slugify(rest.city), wolt: slugify(rest.city) };
        
        // Extract zone if present (e.g., "UNIRII" from "BUC UNIRII")
        let zoneSlug = "";
        const parts = upperCity.split(' ');
        if (parts.length > 1 && !parts[1].includes('#')) {
            zoneSlug = slugify(parts[1]);
        }
        if (upperCity.includes('MILITARI')) zoneSlug = 'militari';
        if (upperCity.includes('UNIRII')) zoneSlug = 'unirii';
        if (upperCity.includes('PIPERA')) zoneSlug = 'pipera';

        let foundGlovo = null;
        let foundWolt = null;

        // --- GLOVO ---
        // For Bucharest, Glovo uses '-buc' suffix for everything
        let glovoCitySuffix = mapping.glovo === 'bucuresti' ? 'buc' : mapping.glovo;
        if (mapping.glovo === 'cluj-napoca') glovoCitySuffix = 'clj';
        if (mapping.glovo === 'timisoara') glovoCitySuffix = 'tsr';
        if (mapping.glovo === 'iasi') glovoCitySuffix = 'ias';
        if (mapping.glovo === 'constanta') glovoCitySuffix = 'cnd';
        if (mapping.glovo === 'sibiu') glovoCitySuffix = 'sbz';
        if (mapping.glovo === 'brasov') glovoCitySuffix = 'bsv';

        const glovoUrlsToTest = [];
        if (zoneSlug) {
            glovoUrlsToTest.push(`https://glovoapp.com/ro/ro/${mapping.glovo}/${brandSlug}-${zoneSlug}-${glovoCitySuffix}/`);
            glovoUrlsToTest.push(`https://glovoapp.com/ro/ro/${mapping.glovo}/${brandSlug}-${glovoCitySuffix}-${zoneSlug}/`);
        }
        glovoUrlsToTest.push(`https://glovoapp.com/ro/ro/${mapping.glovo}/${brandSlug}-${glovoCitySuffix}/`);
        glovoUrlsToTest.push(`https://glovoapp.com/ro/ro/${mapping.glovo}/${brandSlug}/`);

        for (const url of glovoUrlsToTest) {
            if (await checkUrl(url)) {
                foundGlovo = url;
                console.log(`  [Glovo] Found: ${url}`);
                break;
            }
        }
        if (!foundGlovo) console.log(`  [Glovo] ❌ Not found`);

        // --- WOLT ---
        const woltUrlsToTest = [];
        if (zoneSlug) {
            woltUrlsToTest.push(`https://wolt.com/ro/rou/${mapping.wolt}/restaurant/${brandSlug}-${zoneSlug}`);
        }
        woltUrlsToTest.push(`https://wolt.com/ro/rou/${mapping.wolt}/restaurant/${brandSlug}`);

        for (const url of woltUrlsToTest) {
            if (await checkUrl(url)) {
                foundWolt = url;
                console.log(`  [Wolt] Found: ${url}`);
                break;
            }
        }
        if (!foundWolt) console.log(`  [Wolt] ❌ Not found`);

        // Update DB
        const updates = {};
        if (foundGlovo) updates.glovo_url = foundGlovo;
        if (foundWolt) updates.wolt_url = foundWolt;

        if (Object.keys(updates).length > 0) {
            await supabase.from('restaurants').update(updates).eq('id', rest.id);
        }
        
        // Sleep to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("\n✅ URL Mapping Complete!");
    process.exit(0);
}

run();
