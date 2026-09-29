import { supabase } from '../services/supabase.js';
import { launchBrowser } from '../utils/puppeteer-launch.js';
import fetch from 'node-fetch';

const CITY_COORDS = {
    'Bucharest':   { lat: 44.4268, lng: 26.1025 },
    'Cluj-Napoca': { lat: 46.7712, lng: 23.6236 },
    'Timisoara':   { lat: 45.7489, lng: 21.2087 },
    'Iasi':        { lat: 47.1585, lng: 27.6014 },
    'Constanta':   { lat: 44.1598, lng: 28.6348 },
    'Brasov':      { lat: 45.6427, lng: 25.5887 },
    'Galati':      { lat: 45.4353, lng: 28.0080 },
    'Sibiu':       { lat: 45.7983, lng: 24.1256 },
    'Pitesti':     { lat: 44.8565, lng: 24.8692 },
    'Ploiesti':    { lat: 44.9401, lng: 26.0218 },
    'Bacau':       { lat: 46.5670, lng: 26.9146 },
    'Suceava':     { lat: 47.6515, lng: 26.2555 },
    'Targu Mures': { lat: 46.5386, lng: 24.5578 },
    'Braila':      { lat: 45.2692, lng: 27.9574 },
    'Baia Mare':   { lat: 47.6567, lng: 23.5849 },
    'Craiova':     { lat: 44.3302, lng: 23.7949 },
    'Oradea':      { lat: 47.0722, lng: 21.9218 },
    'Arad':        { lat: 46.1667, lng: 21.3167 },
    'Piatra Neamt':{ lat: 46.9283, lng: 26.3705 },
    'Tulcea':      { lat: 45.1764, lng: 28.7904 },
    'Botosani':    { lat: 47.7408, lng: 26.6669 }
};

const CITY_MAPPINGS = [
    { match: 'BUC', name: 'Bucharest', glovoSlug: 'bucuresti', woltSlug: 'bucharest' },
    { match: 'IASI', name: 'Iasi', glovoSlug: 'iasi', woltSlug: 'iasi' },
    { match: 'SIBIU', name: 'Sibiu', glovoSlug: 'sibiu', woltSlug: 'sibiu' },
    { match: 'CONSTANTA', name: 'Constanta', glovoSlug: 'constanta', woltSlug: 'constanta' },
    { match: 'CLUJ', name: 'Cluj-Napoca', glovoSlug: 'cluj-napoca', woltSlug: 'cluj-napoca' },
    { match: 'TIMISOARA', name: 'Timisoara', glovoSlug: 'timisoara', woltSlug: 'timisoara' },
    { match: 'BRASOV', name: 'Brasov', glovoSlug: 'brasov', woltSlug: 'brasov' },
    { match: 'GALATI', name: 'Galati', glovoSlug: 'galati', woltSlug: 'galati' },
    { match: 'PITESTI', name: 'Pitesti', glovoSlug: 'pitesti', woltSlug: 'pitesti' },
    { match: 'PLOIESTI', name: 'Ploiesti', glovoSlug: 'ploiesti', woltSlug: 'ploiesti' },
    { match: 'BACAU', name: 'Bacau', glovoSlug: 'bacau', woltSlug: 'bacau' },
    { match: 'SUCEAVA', name: 'Suceava', glovoSlug: 'suceava', woltSlug: 'suceava' },
    { match: 'MURES', name: 'Targu Mures', glovoSlug: 'targu-mures', woltSlug: 'targu-mures' },
    { match: 'BRAILA', name: 'Braila', glovoSlug: 'braila', woltSlug: 'braila' },
    { match: 'BAIA', name: 'Baia Mare', glovoSlug: 'baia-mare', woltSlug: 'baia-mare' },
    { match: 'CRAIOVA', name: 'Craiova', glovoSlug: 'craiova', woltSlug: 'craiova' },
    { match: 'ORADEA', name: 'Oradea', glovoSlug: 'oradea', woltSlug: 'oradea' },
    { match: 'ARAD', name: 'Arad', glovoSlug: 'arad', woltSlug: 'arad' },
    { match: 'NEAMT', name: 'Piatra Neamt', glovoSlug: 'piatra-neamt', woltSlug: 'piatra-neamt' },
    { match: 'TULCEA', name: 'Tulcea', glovoSlug: 'tulcea', woltSlug: 'tulcea' },
    { match: 'BOTOSANI', name: 'Botosani', glovoSlug: 'botosani', woltSlug: 'botosani' }
];

async function searchWolt(mapping, brandName) {
    const coords = CITY_COORDS[mapping.name];
    if (!coords) return null;

    try {
        const url = `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${coords.lat}&lon=${coords.lng}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' } });
        if (!res.ok) return null;
        
        const d = await res.json();
        const venSection = d.sections?.find(s => s.name === 'restaurants-delivering-venues');
        const allVenues = venSection?.items || [];
        
        const brandLower = brandName.toLowerCase();
        // Look for exact inclusion of the brand name in the Wolt title
        const match = allVenues.find(item => {
            const name = (item.venue?.name || '').toLowerCase();
            return name.includes(brandLower);
        });
        
        if (match) {
            return `https://wolt.com/ro/rou/${mapping.woltSlug}/restaurant/${match.venue.slug}`;
        }
    } catch (e) {
        console.error("Wolt Error:", e.message);
    }
    return null;
}

async function searchGlovo(browser, mapping, brandName) {
    const page = await browser.newPage();
    try {
        const url = `https://glovoapp.com/ro/ro/${mapping.glovoSlug}/?search=${encodeURIComponent(brandName)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));
        
        const links = await page.evaluate((brandQuery) => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/stores/"], a[href*="/ro/ro/"]'));
            // Filter anchors that have a matching brand slug in the href
            // Usually Glovo urls look like /ro/ro/bucuresti/we-love-sushi-buc/
            const bSlug = brandQuery.toLowerCase().replace(/\s+/g, '-');
            const bParts = brandQuery.toLowerCase().split(' ');
            
            return anchors.map(a => a.href).filter(href => {
                const isStore = href.includes('/stores/') || href.split('/').length > 5;
                if (!isStore) return false;
                const urlLower = href.toLowerCase();
                return urlLower.includes(bSlug) || bParts.every(p => urlLower.includes(p));
            });
        }, brandName);

        if (links.length > 0) {
            return links[0]; // First matching link
        }
    } catch (e) {
        console.error("Glovo Error:", e.message);
    } finally {
        await page.close();
    }
    return null;
}

async function run() {
    console.log("🚀 Starting Advanced URL Mapper (Real Search)...");
    
    // Fetch all active restaurants that need URLs
    const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, city, glovo_url, wolt_url, bolt_url')
        .eq('is_active', true);

    const browser = await launchBrowser();
    let updatedCount = 0;

    for (const rest of restaurants) {
        console.log(`\n🔎 Searching: ${rest.name} (${rest.city})`);
        
        const brandMatch = rest.name.match(/\((.*?)\)/);
        const brandName = brandMatch ? brandMatch[1] : rest.name;
        
        const upperCity = rest.city.toUpperCase();
        let mapping = CITY_MAPPINGS.find(m => upperCity.includes(m.match));
        if (!mapping) {
            console.log("  ⚠️ Missing city mapping for", rest.city);
            continue;
        }

        const updates = {};

        // WOLT
        if (!rest.wolt_url) {
            const woltLink = await searchWolt(mapping, brandName);
            if (woltLink) {
                console.log(`  [Wolt] ✅ FOUND: ${woltLink}`);
                updates.wolt_url = woltLink;
            } else {
                console.log(`  [Wolt] ❌ Not found on platform.`);
            }
        } else {
            console.log(`  [Wolt] Already has link: ${rest.wolt_url}`);
        }

        // GLOVO
        if (!rest.glovo_url) {
            const glovoLink = await searchGlovo(browser, mapping, brandName);
            if (glovoLink) {
                console.log(`  [Glovo] ✅ FOUND: ${glovoLink}`);
                updates.glovo_url = glovoLink;
            } else {
                console.log(`  [Glovo] ❌ Not found on platform.`);
            }
        } else {
            console.log(`  [Glovo] Already has link: ${rest.glovo_url}`);
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from('restaurants').update(updates).eq('id', rest.id);
            updatedCount++;
        }
    }

    await browser.close();
    console.log(`\n✅ Advanced URL Mapping Complete! Updated ${updatedCount} restaurants.`);
    process.exit(0);
}

run();
