import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());
async function test() {
    console.log('Launching browser...');
    try {
        const browser = await puppeteer.launch({ headless: true });
        console.log('Browser launched successfully!');
        await browser.close();
    } catch (err) {
        console.error('Error launching:', err);
    }
}
test();
