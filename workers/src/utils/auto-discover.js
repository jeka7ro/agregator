import puppeteer from 'puppeteer'
import { supabase } from '../services/supabase.js'

function generateSearchTerm(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ikura')) return 'ikura sushi';
    if (lowerName.includes('love sushi')) return 'love sushi';
    if (lowerName.includes('roll master')) return 'roll master';
    if (lowerName.includes('poki woki')) return 'poki woki';
    if (lowerName.includes('crunch')) return 'crunch';
    return 'sushi master';
}

function generateSearchCity(city) {
    if (city.toLowerCase().includes('buc')) return 'bucuresti';
    if (city.toLowerCase() === 'cluj-napoca' || city.toLowerCase() === 'cluj') return 'cluj-napoca';
    return city.toLowerCase();
}

function serializeName(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function nameMatches(text, targetName, brandSearch) {
    const sText = serializeName(text);
    return sText.includes(serializeName(targetName)) || sText.includes(serializeName(brandSearch));
}

export async function discoverSingleRestaurant(restaurant) {
    const { name, city, iiko_restaurant_id } = restaurant;
    const searchBrand = generateSearchTerm(name);
    const searchCity = generateSearchCity(city);
    
    console.log(`[AutoSearch] Starting discovery for ${name} (${searchBrand}) in ${searchCity}...`);

    const browser = await puppeteer.launch({ 
        headless: 'new', 
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    const urls = { glovo_url: null, wolt_url: null, bolt_url: null };

    // 1. Glovo
    try {
        const u = `https://glovoapp.com/ro/ro/${searchCity}/search/?q=${encodeURIComponent(searchBrand)}`;
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const glovoLink = await page.evaluate((sBrand) => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/stores/"]'));
            for (const a of anchors) {
                const txt = a.textContent.toLowerCase();
                if (txt.includes('sushi') || txt.includes('ikura')) {
                    return a.getAttribute('href');
                }
            }
            return null;
        }, searchBrand);
        
        if (glovoLink) {
            urls.glovo_url = glovoLink.startsWith('/') ? `https://glovoapp.com${glovoLink}` : glovoLink;
            console.log(`[AutoSearch] Glovo found: ${urls.glovo_url}`);
        }
    } catch(e) { console.error('[AutoSearch] Glovo error:', e.message); }

    // 2. Wolt
    try {
        const u = `https://wolt.com/ro/rou/${searchCity}/search?q=${encodeURIComponent(searchBrand)}`;
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const woltLink = await page.evaluate((sBrand) => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/restaurant/"], a[href*="/venue/"]'));
            for (const a of anchors) {
                const txt = a.textContent.toLowerCase();
                if (txt.includes('sushi') || txt.includes(sBrand.split(' ')[0])) {
                    return a.getAttribute('href');
                }
            }
            return null;
        }, searchBrand);

        if (woltLink) {
            urls.wolt_url = woltLink.startsWith('/') ? `https://wolt.com${woltLink}` : woltLink;
            console.log(`[AutoSearch] Wolt found: ${urls.wolt_url}`);
        }
    } catch(e) { console.error('[AutoSearch] Wolt error:', e.message); }

    // 3. Bolt
    try {
        const bCity = searchCity === 'bucuresti' ? 'bucuresti' : `226-${searchCity}`;
        const u = `https://food.bolt.eu/ro-RO/${bCity}/search/?q=${encodeURIComponent(searchBrand)}`;
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const boltLink = await page.evaluate((sBrand) => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/restaurant/"]'));
            for (const a of anchors) {
                const txt = a.textContent.toLowerCase();
                if (txt.includes('sushi') || txt.includes(sBrand.split(' ')[0])) {
                    return a.getAttribute('href');
                }
            }
            return null;
        }, searchBrand);

        if (boltLink) {
            urls.bolt_url = boltLink.startsWith('/') ? `https://food.bolt.eu${boltLink}` : boltLink;
            console.log(`[AutoSearch] Bolt found: ${urls.bolt_url}`);
        }
    } catch(e) { console.error('[AutoSearch] Bolt error:', e.message); }

    await browser.close();

    // Verify if we should save
    if (urls.glovo_url || urls.wolt_url || urls.bolt_url) {
        console.log(`[AutoSearch] Saving links for ${name} to Supabase...`);
        // Save to DB
        const { data: existing } = await supabase.from('restaurants').select('id').eq('iiko_restaurant_id', iiko_restaurant_id).single();
        if (existing) {
            await supabase.from('restaurants').update(urls).eq('id', existing.id);
        } else {
            await supabase.from('restaurants').insert({
                name,
                city: city.toUpperCase(),
                iiko_restaurant_id,
                is_active: true,
                brand_id: name.toLowerCase().includes('ikura') ? 2 : 1,
                ...urls
            });
        }
        return { success: true, urls };
    }

    return { success: false, urls };
}
