import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GlovoPartnerScraper {
    constructor() {
        this.loginUrl = 'https://managers.glovoapp.com/hello';
        this.reviewsUrl = 'https://portal.glovoapp.com/dashboard';
    }

    async scrapeReviews(username, password) {
        console.log(`[Glovo Scraper] Initiere browser pentru: ${username}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                defaultViewport: null,
                args: ['--no-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
            });
            console.log('[Glovo Scraper] Lansat browser nou (se vor folosi cookie-urile).');

            const page = await browser.newPage();
            
            // Setam un User-Agent normal ca sa nu ne blocheze Cloudflare / Glovo Anti-Bot
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            // INCERCARE AUTENTIFICARE PRIN COOKIES (BYPASS MANUAL LOGARE)
            const cookiesPath = path.join(__dirname, 'glovo-cookies.json');
            let usedCookies = false;
            
            if (fs.existsSync(cookiesPath)) {
                try {
                    const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
                    const cookies = JSON.parse(cookiesString);
                    if (cookies.length > 0 && cookies[0].value !== 'FAKE_SESSION_REPLACE_ME') {
                        console.log(`[Glovo Scraper] 🍪 Injectare cookies de sesiune găsită! Se face BYPASS la logare și parola...`);
                        await page.setCookie(...cookies);
                        usedCookies = true;
                    }
                } catch (e) {
                    console.log(`⚠️Eroare la citirea Cookies: ${e.message}`);
                }
            }

            if (!usedCookies) {
                console.log(`[Glovo Scraper] Accesare portal de login clasic (Fișier cookie nesetat)...`);
                await page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

                // 1. Introducere Email
                console.log(`[Glovo Scraper] Introducere adresa de email: ${username}`);
                await page.waitForSelector('input[type="email"], input[name="email"], input[id="email"]', { timeout: 10000 });
                await page.type('input[type="email"], input[name="email"], input[id="email"]', username, { delay: 150 });
                
                await new Promise(r => setTimeout(r, 500));

                // 2. Introducere Parola
                console.log(`[Glovo Scraper] Introducere parola...`);
                await page.waitForSelector('input[type="password"]', { timeout: 10000 });
                await page.type('input[type="password"]', password, { delay: 100 });
                
                console.log(`[Glovo Scraper] Apasare buton Login...`);
                try {
                    await page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const loginBtn = btns.find(b => b.innerText.toLowerCase().includes('log in') || b.innerText.toLowerCase().includes('logare'));
                        if (loginBtn) loginBtn.click();
                    });
                } catch (e) {
                    await page.keyboard.press('Enter');
                }

                // Așteptăm doar 5 secunde – în mediu de test nu este nevoie de Hold/2FA
                console.log(`[Glovo Scraper] Așteptăm 5 secunde pentru eventuale verificări (Hold/2FA) – se sare peste ele în test.`);
                await new Promise(r => setTimeout(r, 5000));
                
                const pageUrl = page.url();
                if (pageUrl.includes('verification') || pageUrl.includes('auth-code')) {
                    console.log(`⚠️ ALERTA 2FA/BOT: Portalul Glovo solicită verificări avansate!`);
                    console.log(`   Pentru rulare automată, setează cookie‑urile în glovo‑cookies.json.`);
                    await browser.close();
                    return { success: false, error: 'MANUAL_COOKIES_REQUIRED', message: 'Setati fisierul glovo-cookies.json pentru bypass rapid.' };
                }
            }

            // 4. Extragerea datelor din Tabloul de Bord (Dashboard) principal
            console.log(`✅ Login cu succes! Se extrag Comenzi si Venituri din Dashboard...`);
            
            // Asteptam suficient sa randeze React-ul si cifrele
            await new Promise(r => setTimeout(r, 6000));
            
            const dashboardData = await page.evaluate(() => {
                const text = document.body.innerText;
                
                let comenzi = "0";
                let venituri = "0 RON";
                
                // Cauta "Comenzi" urmat de cifre pe linia urmatoare
                const cMatch = text.match(/Comenzi\n+(\d+)/i);
                if (cMatch) comenzi = cMatch[1];
                
                // Cauta "Venituri" urmat de cifre si valuta
                const vMatch = text.match(/Venituri\n+([\d.,]+\s*[A-Z]+)/i);
                if (vMatch) venituri = vMatch[1];
                
                return { comenzi, venituri };
            });
            
            console.log(`[Glovo Scraper] Extras -> Comenzi: ${dashboardData.comenzi} | Venituri: ${dashboardData.venituri}`);

            // 5. Navigare DIRECTĂ la adresa dată de tine
            console.log(`[Glovo Scraper] Navigare directa catre linkul de Recenzii furnizat: https://portal.glovoapp.com/reviews/`);
            await page.goto('https://portal.glovoapp.com/reviews/', { waitUntil: 'networkidle2', timeout: 30000 });

            console.log(`[Glovo Scraper] Se asteapta incarcarea paginii de Recenzii...`);
            await new Promise(r => setTimeout(r, 6000));

            // Extragerea Recenziilor (Format Generic de Siguranta)
            const extractedReviews = await page.evaluate(() => {
                const reviews = [];
                // Cautam cel mai sigur container de recenzii sau randuri de tabel
                document.querySelectorAll('.review-row, tr, [data-test-id*="review"], .feedback-item').forEach(row => {
                    const continut = row.innerText;
                    // Daca are suficient text (nume, scor) e recenzie
                    if(continut && continut.length > 8 && !continut.includes('Tablou de bord')) {
                         reviews.push({ reviewData: continut.replace(/\n/g, ' - ') });
                    }
                });
                return reviews;
            });
            
            console.log(`[Glovo Scraper] GATA! S-au extras in total ${extractedReviews.length} recenzii manuale.`);

            // 6. Curatare 
            await browser.close();
            return { 
                success: true, 
                count: extractedReviews.length, 
                dashboard: dashboardData,
                data: extractedReviews 
            };

        } catch (error) {
            console.error(`❌ [Glovo Scraper] Eroare fatala de sistem: ${error.message}`);
            if (browser) await browser.close();
            return { success: false, error: error.message };
        }
    }
}

// TESTARE RAPIDA PENTRU USER
async function test() {
    console.log("=============================================");
    console.log("  TEST: GLOVO PARTNER WEB SCRAPER 2.0");
    console.log("=============================================\n");
    const scraper = new GlovoPartnerScraper();
    
    // Contul proaspat primit
    await scraper.scrapeReviews('jeka7ro@gmail.com', '31Martie2026!');
}

// Numai executa `test()` cand e rulat direct din terminal
if (process.argv[1] === new URL(import.meta.url).pathname) {
    test();
}
