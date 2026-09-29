import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_KEY);

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
    if (!city) return 'bucuresti';
    const c = city.toLowerCase();
    if (c.includes('buc')) return 'bucuresti';
    if (c.includes('cluj')) return 'cluj-napoca';
    if (c.includes('iasi')) return 'iasi';
    if (c.includes('constanta')) return 'constanta';
    return c;
}

async function run() {
    console.log('Fetching active restaurants...');
    const { data: restaurants, error } = await supabase.from('restaurants').select('*').eq('is_active', true).limit(5);
    if (error) { console.error('DB Error:', error); return; }

    console.log(`Found ${restaurants.length} restaurants to search. Launching browser...`);
    
    const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    let sqlStmts = [];

    for (const r of restaurants) {
        const searchBrand = generateSearchTerm(r.name);
        const searchCity = generateSearchCity(r.city);
        console.log(`\n🔍 Searching for ${r.name} (${searchBrand} in ${searchCity})...`);

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        let urls = { glovo_url: null, wolt_url: null };

        // 1. Glovo
        try {
            const u = `https://glovoapp.com/ro/ro/${searchCity}/search/?q=${encodeURIComponent(searchBrand)}`;
            await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(res => setTimeout(res, 2000));
            
            const glovoLink = await page.evaluate((sBrand) => {
                const anchors = Array.from(document.querySelectorAll('a[href*="/stores/"]'));
                for (const a of anchors) {
                    const txt = a.textContent.toLowerCase();
                    if (txt.includes('sushi') || txt.includes('ikura') || txt.includes(sBrand.split(' ')[0])) {
                        return a.getAttribute('href');
                    }
                }
                return null;
            }, searchBrand);
            
            if (glovoLink) urls.glovo_url = glovoLink.startsWith('/') ? `https://glovoapp.com${glovoLink}` : glovoLink;
        } catch(e) {}

        // 2. Wolt
        try {
            const u = `https://wolt.com/ro/rou/${searchCity}/search?q=${encodeURIComponent(searchBrand)}`;
            await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(res => setTimeout(res, 2000));
            
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

            if (woltLink) urls.wolt_url = woltLink.startsWith('/') ? `https://wolt.com${woltLink}` : woltLink;
        } catch(e) {}

        await page.close();

        console.log(`   ✅ Glovo: ${urls.glovo_url || 'N/A'}`);
        console.log(`   ✅ Wolt: ${urls.wolt_url || 'N/A'}`);

        let updates = [];
        if (urls.glovo_url) updates.push(`glovo_url = '${urls.glovo_url}'`);
        if (urls.wolt_url) updates.push(`wolt_url = '${urls.wolt_url}'`);
        
        if (updates.length > 0) {
            sqlStmts.push(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = '${r.id}';`);
        }
    }

    await browser.close();

    fs.writeFileSync('fix_links.sql', sqlStmts.join('\n'));
    console.log('\n✅ DONE! Wrote SQL statements to fix_links.sql');
}

run();
