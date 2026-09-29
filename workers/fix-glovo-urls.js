import { launchBrowser } from './src/utils/puppeteer-launch.js';
import { supabase } from './src/services/supabase.js';

async function run() {
    console.log("Checking Glovo URLs for 404s...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, glovo_url').not('glovo_url', 'is', null);
    
    console.log(`Found ${restaurants.length} URLs to check.`);
    const browser = await launchBrowser();
    const page = await browser.newPage();
    
    let fixed = 0;
    for (const rest of restaurants) {
        try {
            console.log(`Checking: ${rest.name} -> ${rest.glovo_url}`);
            await page.goto(rest.glovo_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const content = await page.content();
            if (content.includes('Oh, no!') || content.includes('It looks like there\'s a problem')) {
                console.log(`❌ INVALID: ${rest.name}`);
                await supabase.from('restaurants').update({ glovo_url: null }).eq('id', rest.id);
                fixed++;
            } else {
                console.log(`✅ VALID: ${rest.name}`);
            }
        } catch (e) {
            console.log(`Error checking ${rest.name}:`, e.message);
        }
    }
    
    await browser.close();
    console.log(`Done. Removed ${fixed} invalid Glovo URLs.`);
    process.exit(0);
}

run();
