import { launchBrowser } from './src/utils/puppeteer-launch.js';

async function searchGoogle(brand, city) {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const q = `site:glovoapp.com/ro/ro/ ${brand} ${city}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a'));
        return anchors.map(a => a.href).filter(href => href.includes('glovoapp.com/ro/ro/'));
    });
    console.log(links);
    await browser.close();
}
searchGoogle('Roll Master', 'Piatra Neamt');
searchGoogle('Smash Me', 'Constanta');
