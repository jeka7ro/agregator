import { launchBrowser } from './src/utils/puppeteer-launch.js';

async function testGlovo(city, brand) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const url = `https://glovoapp.com/ro/ro/${city.toLowerCase().replace(/\s+/g,'-')}/?search=${encodeURIComponent(brand)}`;
    console.log("Loading", url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    
    const links = await page.evaluate((brandName) => {
        return Array.from(document.querySelectorAll('a[href*="/ro/ro/"]'))
            .map(a => a.href)
            .filter(href => href.includes(brandName.toLowerCase().replace(/\s+/g,'-')) || href.includes('stores/'));
    }, brand);
    console.log(links);
    await browser.close();
}
testGlovo('Piatra Neamt', 'Roll Master');
