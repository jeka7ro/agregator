import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import puppeteer from 'puppeteer'
import path from 'path'

dotenv.config({ path: '../.env.local' })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

async function getLinks(keyword, city) {
    const urls = { glovo_url: '', wolt_url: '', bolt_url: '' };
    const browser = await puppeteer.launch({ headless: 'new', args: ['--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()] });
    const page = await browser.newPage();
    try {
        console.log(`Caut pe Glovo: ${keyword} ${city}...`);
        await page.goto(`https://glovoapp.com/ro/ro/${city}/search/?q=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000));
        let glovoHref = await page.evaluate(() => {
            const el = document.querySelector('a[href*="/stores/"]');
            return el ? el.getAttribute('href') : null;
        });
        if (glovoHref) urls.glovo_url = glovoHref.startsWith('/') ? `https://glovoapp.com${glovoHref}` : glovoHref;

        console.log(`Caut pe Bolt: ${keyword} ${city}...`);
        const bCity = city === 'bucuresti' ? 'bucuresti' : `226-${city}`;
        await page.goto(`https://food.bolt.eu/ro-RO/${bCity}/search/?q=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000));
        let boltHref = await page.evaluate(() => {
            const el = document.querySelector('a[href*="/restaurant/"]');
            return el ? el.getAttribute('href') : null;
        });
        if (boltHref) urls.bolt_url = boltHref.startsWith('/') ? `https://food.bolt.eu${boltHref}` : boltHref;

        console.log(`Caut pe Wolt: ${keyword} ${city}...`);
        await page.goto(`https://wolt.com/ro/rou/${city}/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 2000));
        let woltHref = await page.evaluate(() => {
            const el = document.querySelector('a[href*="/venue/"], a[href*="/restaurant/"]');
            return el ? el.getAttribute('href') : null;
        });
        if (woltHref) urls.wolt_url = woltHref.startsWith('/') ? `https://wolt.com${woltHref}` : woltHref;

    } catch (e) {
        console.log('Eroare cautare:', e.message);
    }
    await browser.close();
    return urls;
}

async function fix() {
    // Luat direct din screen/log
    const targets = [
        { name: "IKURA ORADEA", city: "oradea", search: "ikura sushi" },
        { name: "SM ORADEA", city: "oradea", search: "sushi master" },
        { name: "SM BUC TITAN", city: "bucuresti", search: "sushi master titan" },
        { name: "SM CLUJ", city: "cluj-napoca", search: "sushi master" },
        { name: "SM SIBIU", city: "sibiu", search: "sushi master" }
    ];
    
    // Check if these are already in 'restaurants' table
    for (const t of targets) {
        console.log(`=> Rezolvare [${t.name}]`);
        const links = await getLinks(t.search, t.city);
        console.log(`Gasite:`, links);
        
        const { data: ext } = await supabase.from('restaurants').select('id, name').ilike('name', `%${t.name}%`);
        
        if (ext && ext.length > 0) {
            console.log(`[UPDATE] ${t.name} (id: ${ext[0].id})`);
            await supabase.from('restaurants').update(links).eq('id', ext[0].id);
        } else {
            console.log(`[INSERT] ${t.name}`);
            await supabase.from('restaurants').insert({
                name: t.name,
                city: t.city.toUpperCase(),
                is_active: true,
                ...links
            });
        }
    }
    console.log("Terminat!");
}
fix();
