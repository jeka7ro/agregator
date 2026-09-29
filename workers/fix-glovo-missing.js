import { supabase } from './src/services/supabase.js';
import { launchBrowser } from './src/utils/puppeteer-launch.js';

async function run() {
    const { data } = await supabase.from('restaurants').select('id, name, city').eq('is_active', true);
    const missingGlovo = data.filter(d => !d.glovo_url);
    
    console.log(`Checking ${missingGlovo.length} missing Glovo via advanced search...`);
    const browser = await launchBrowser();
    const page = await browser.newPage();
    let count = 0;
    
    for (const rest of missingGlovo) {
        const brandMatch = rest.name.match(/\((.*?)\)/);
        const brandName = brandMatch ? brandMatch[1] : rest.name;
        const url = `https://glovoapp.com/ro/ro/${rest.city.toLowerCase().replace(/\s+/g,'-')}/?search=${encodeURIComponent(brandName)}`;
        
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await new Promise(r => setTimeout(r, 2000));
            const link = await page.evaluate((b) => {
                const links = Array.from(document.querySelectorAll('a[href*="/ro/ro/"]'))
                    .map(a => a.href)
                    .filter(href => href.includes('stores/') && (href.includes(b.toLowerCase().replace(/\s+/g,'-')) || href.includes(b.toLowerCase().split(' ')[0])));
                return links.length > 0 ? links[0] : null;
            }, brandName);
            
            if (link) {
                console.log(`✅ [Glovo] ${rest.name}: ${link}`);
                await supabase.from('restaurants').update({ glovo_url: link }).eq('id', rest.id);
                count++;
            } else {
                console.log(`❌ [Glovo] ${rest.name}`);
            }
        } catch (e) {}
    }
    await browser.close();
    console.log(`Updated ${count} Glovo URLs.`);
    process.exit(0);
}
run();
