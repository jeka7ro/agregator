import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer'

const supabase = createClient(
  'https://arzxvzjyiwmkxgoagjcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTU3NjMsImV4cCI6MjA4ODczMTc2M30.bGsx8wA1EDSXuuQs0keCDOx4L4PPY9Ar3LhVJer7DGM'
);

function generateSearchTerm(name) {
    if (name.toLowerCase().includes('ikura')) return 'ikura sushi';
    return 'sushi master';
}

function generateSearchCity(city) {
    if (city.toLowerCase().includes('buc')) return 'bucuresti';
    if (city.toLowerCase() === 'cluj-napoca' || city.toLowerCase() === 'cluj') return 'cluj-napoca';
    return city.toLowerCase();
}

async function getLinks(name, city) {
    const searchBrand = generateSearchTerm(name);
    const searchCity = generateSearchCity(city);
    
    console.log(`[AutoSearch] Caut ${searchBrand} in ${searchCity}...`);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()] });
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
                if (txt.includes('sushi') || txt.includes('ikura')) return a.getAttribute('href');
            }
            return null;
        }, searchBrand);
        if (glovoLink) urls.glovo_url = glovoLink.startsWith('/') ? `https://glovoapp.com${glovoLink}` : glovoLink;
    } catch(e) {}

    // 2. Wolt
    try {
        const u = `https://wolt.com/ro/rou/${searchCity}/search?q=${encodeURIComponent(searchBrand)}`;
        await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        const woltLink = await page.evaluate((sBrand) => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/restaurant/"], a[href*="/venue/"]'));
            for (const a of anchors) {
                const txt = a.textContent.toLowerCase();
                if (txt.includes('sushi') || txt.includes(sBrand.split(' ')[0])) return a.getAttribute('href');
            }
            return null;
        }, searchBrand);
        if (woltLink) urls.wolt_url = woltLink.startsWith('/') ? `https://wolt.com${woltLink}` : woltLink;
    } catch(e) {}

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
                if (txt.includes('sushi') || txt.includes(sBrand.split(' ')[0])) return a.getAttribute('href');
            }
            return null;
        }, searchBrand);
        if (boltLink) urls.bolt_url = boltLink.startsWith('/') ? `https://food.bolt.eu${boltLink}` : boltLink;
    } catch(e) {}

    await browser.close();
    return urls;
}

async function fixCustom() {
    const targets = [
        { name: "IKURA ORADEA", city: "oradea", iiko_restaurant_id: "fba7fb0d-5872-4d7a-a660-fef7b539fa04" },
        { name: "SM ORADEA", city: "oradea", iiko_restaurant_id: "647d6cc7-874e-4f32-84cc-fca2114ac3be" },
        { name: "SM BUC TITAN", city: "bucuresti", iiko_restaurant_id: "bdcce8f6-17b5-4b36-bef8-dd5ae9fcd2e9" },
        { name: "SM CLUJ", city: "cluj-napoca", iiko_restaurant_id: "1722dadd-55a0-4ff9-8f4b-2d7c50ff3411" }
    ];

    for (const t of targets) {
        console.log(`\nRezolvare [${t.name}]`);
        const links = await getLinks(t.name, t.city);
        console.log(`Gasite:`, links);
        
        // Wipe old false instances if any
        await supabase.from('restaurants').delete().in('name', [t.name]);

        // Insert new clean instances
        const { error } = await supabase.from('restaurants').insert({
            name: t.name,
            city: t.city.toUpperCase(),
            iiko_restaurant_id: t.iiko_restaurant_id,
            is_active: true,
            ...links
        });
        if (error) console.error("Eroare inserare:", error);
        else console.log(`[INSERT OK] ${t.name}`);
    }
    console.log("Terminat!");
}

fixCustom();
