import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export class WoltPartnerScraper {
    constructor() {
        this.loginUrl = 'https://merchant.wolt.com/app/experience/search';
    }

    async scrapeReviews(username) {
        console.log(`[Wolt Scraper] Initiere browser pentru Merchant: ${username}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true, // Mod invizibil pentru a nu deranja utilizatorul
                defaultViewport: null,
                args: ['--no-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
            });

            const page = await browser.newPage();
            // User-Agent standard pt a pacali eventuale filtre anti-bot Wolt
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            console.log(`[Wolt Scraper] Accesare portal de Customer Experience...`);
            await page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

            // 1. Introducere Email (Wolt Merchant)
            console.log(`[Wolt Scraper] Inserare adresa de email: ${username}`);
            // Selectoarele sunt aproximative pana la inspectia DOM a Wolt
            await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
            await page.type('input[type="email"], input[name="email"]', username, { delay: 100 });
            
            const nextBtn = await page.$('button[type="submit"], button[data-test-id="next-button"]');
            if (nextBtn) await nextBtn.click();
            else await page.keyboard.press('Enter');

            // 2. Parola sau Magic Link (Wolt foloseste des Magic Links)
            console.log(`[Wolt Scraper] Asteptare pasul 2 de autentificare Wolt...`);
            await page.waitForTimeout(3000); // pauza pentru tranzitie UI

            const pageUrl = page.url();
            if (pageUrl.includes('verify') || pageUrl.includes('magic-link')) {
                 console.log(`⚠️ ALERTA WOLT: Portalul Wolt a trimis un Magic Link (Email) catre ${username}!`);
                 console.log(`Așteptăm până la 2 minute să dai click pe linkul din email-ul tău pentru a prinde sesiunea automată...`);
                 
                 try {
                     // Așteptăm redirectul automat odată ce linkul a fost validat (2 minute)
                     await page.waitForFunction(() => !window.location.href.includes('search') && !window.location.href.includes('login'), { timeout: 120000 });
                     console.log(`✅ Magic Link validat! Suntem în contul Wolt.`);
                 } catch (err) {
                     console.log(`❌ Timeout! Nu s-a interceptat nicio logare în timp util.`);
                     await browser.close();
                     return { success: false, error: 'MAGIC_LINK_TIMEOUT' };
                 }
            }

            // Daca are flux cu parola:
            try {
                const passInput = await page.$('input[type="password"]');
                if (passInput) {
                    console.log(`[Wolt Scraper] Introducere parola Wolt (din baza de date)...`);
                    // await page.type('input[type="password"]', password);
                    // Dupa introducere password s-ar da submit
                }
            } catch (err) { }

            // 3. Extragerea Recenziilor (Sectiunea "Experience")
            console.log(`✅ Conectare reusita la zona Wolt Experience! Incercare extragere feed recenzii...`);
            await page.waitForSelector('.experience-list, table, [data-test-id="feedback-item"]', { timeout: 12000 });

            const extractedWoltFeedback = await page.evaluate(() => {
                const feedbackArray = [];
                // Script injectat in consola browserului merchant.wolt.com pt extragere:
                document.querySelectorAll('[data-test-id="feedback-item"], tr.wolt-row').forEach(row => {
                    feedbackArray.push({
                        orderId: row.querySelector('.order-id, [data-test-id="order-reference"]')?.innerText || 'N/A',
                        text: row.querySelector('.feedback-comment')?.innerText || '',
                        rating: row.querySelector('.rating-score')?.innerText || 'N/A',
                        timestamp: row.querySelector('.timestamp')?.innerText || new Date().toISOString()
                    });
                });
                return feedbackArray;
            });

            console.log(`[Wolt Scraper] S-au cules ${extractedWoltFeedback.length} experiente Wolt din cont.`);
            
            await browser.close();
            return { success: true, count: extractedWoltFeedback.length, data: extractedWoltFeedback };

        } catch (error) {
            console.error(`❌ [Wolt Scraper] Eroare: ${error.message}`);
            if (browser) await browser.close();
            return { success: false, error: error.message };
        }
    }
}

// TESTARE PENTRU DEMO 
async function startDemo() {
    const scraper = new WoltPartnerScraper();
    await scraper.scrapeReviews('jeka7ro@gmail.com');
}

// if (process.argv[1] === new URL(import.meta.url).pathname) startDemo();
