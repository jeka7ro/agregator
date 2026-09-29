import puppeteer from 'puppeteer';

async function run() {
    const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox'] 
    });
    const page = await browser.newPage();
    await page.goto('https://developer.bolt.eu/food/main/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract all text content
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
    await browser.close();
}

run();
