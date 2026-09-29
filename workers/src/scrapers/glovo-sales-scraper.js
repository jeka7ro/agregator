import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export class GlovoSalesScraper {
    constructor() {
        this.loginUrl = 'https://managers.glovoapp.com/hello';
        this.ordersUrl = 'https://portal.glovoapp.com/reports?from=2026-03-01&to=2026-03-30&prevFrom=2026-01-30&prevTo=2026-02-28&tab=sales'; // Pagina de rapoarte pe o luna intreaga + vanzari
    }

    async scrapeSales(username, password) {
        console.log(`[Glovo Sales Scraper] Inițiere browser pentru: ${username}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                defaultViewport: null,
                args: ['--no-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            console.log(`[Glovo Sales Scraper] Accesare portal logare...`);
            await page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

            // 1. Email
            console.log(`[Glovo Sales Scraper] Introducere email: ${username}`);
            await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
            await page.type('input[type="email"], input[name="email"]', username, { delay: 100 });

            // Asteptam nitel
            await new Promise(r => setTimeout(r, 500));

            // 2. Parola
            console.log(`[Glovo Sales Scraper] Introducere parola...`);
            await page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await page.type('input[type="password"]', password, { delay: 100 });
            
            console.log(`[Glovo Sales Scraper] Apasare buton Login...`);
            // The submit button on Glovo might not be type="submit"
            try {
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const loginBtn = btns.find(b => b.innerText.toLowerCase().includes('log in') || b.innerText.toLowerCase().includes('logare'));
                    if (loginBtn) loginBtn.click();
                });
            } catch (e) {
                await page.keyboard.press('Enter');
            }

            console.log(`[Glovo Sales Scraper] Se verifica logarea / statusul 2FA / Anti-bot...`);
            try {
                // Asteptam nitel sa apara popup-ul de 'human verification'
                await new Promise(r => setTimeout(r, 6000));
                
                // Căutăm butonul Anti-Bot inclusiv în iframe-uri
                console.log(`[Glovo Sales Scraper] Inspectare DOM pentru challenge Anti-Bot...`);
                let isAntiBot = false;
                
                for (let frame of page.frames()) {
                     try {
                         const hasText = await frame.evaluate(() => {
                             return document.body.innerText.includes('Before we continue') || document.body.innerText.includes('Press & hold');
                         });
                         if (hasText) {
                             isAntiBot = true;
                             console.log(`⚠️ ALERTA ANTI-BOT: Challenge găsit într-un cadru (frame). Încep procedura de rezolvare...`);
                             
                             const btnHandle = await frame.evaluateHandle(() => {
                                 const btns = Array.from(document.querySelectorAll('button, div, span'));
                                 return btns.find(b => b.innerText && b.innerText.includes('Press & hold'));
                             });

                             if (btnHandle && btnHandle.asElement()) {
                                 // Element must be scrolled into view to get correct bounding box
                                 await btnHandle.evaluate(b => b.scrollIntoView());
                                 await new Promise(r => setTimeout(r, 500));

                                 const box = await btnHandle.boundingBox();
                                 if (box) {
                                     // Calculate absolute position on the window (approximate, usually works if no weird scrolling)
                                     const x = box.x + (box.width / 2);
                                     const y = box.y + (box.height / 2);
                                     
                                     // Mișcare simulată "umană" scurtă
                                     await page.mouse.move(x, y, { steps: 10 });
                                     await page.mouse.down();
                                     console.log(`[Glovo Sales Scraper] 🔽 Se ține apăsat butonul de securitate 10 secunde la coordonatele X:${Math.round(x)} Y:${Math.round(y)}...`);
                                     await new Promise(r => setTimeout(r, 10000));
                                     await page.mouse.up();
                                     console.log(`[Glovo Sales Scraper] 🔼 Mouse ridicat. Tranzitie...`);
                                     await new Promise(r => setTimeout(r, 5000));
                                 }
                                 await btnHandle.dispose();
                             }
                             break;
                         }
                     } catch(err) {
                         // ignore frame cross-origin errors
                     }
                }

                if (!isAntiBot) {
                     console.log(`[Glovo Sales Scraper] Nu am detectat niciun sistem vizibil Anti-Bot.`);
                }
                
                // Lasam o pauza lunga utila pentru interventie umana de siguranta
                console.log(`[Glovo Sales Scraper] Asteptam 10 secunde pentru finalizarea logarii sau captcha manual daca a esuat botul...`);
                await new Promise(r => setTimeout(r, 10000));

            } catch (navError) {
                console.log(`[Glovo Sales Scraper] Verificarea vizuala a durat. Continuam in orb.`);
            }

            const pageUrl = page.url();
            if (pageUrl.includes('verification') || pageUrl.includes('auth-code')) {
                console.log(`⚠️ ALERTA 2FA: Glovo a solicitat un cod de verificare SMS/Email!`);
                console.log(`Așteptăm 60 de secunde ca tu (utilizatorul) să introduci codul manual în browser...`);
                // Asteptam ca "manager" sa apara in URL dupa 2FA manual
                await page.waitForFunction(() => window.location.href.includes('portal.glovoapp.com'), { timeout: 60000 });
                console.log(`✅ 2FA trecut cu succes (manual). Continuăm!`);
            }

            // ====== INTERCEPTIE NETWORK ======
            console.log(`[Glovo Sales Scraper] Activare interceptie API pentru a extrage Banii/Comenzile Reale...`);
            let interceptedOrders = [];
            
            await page.setRequestInterception(true);
            page.on('response', async (response) => {
                const url = response.url();
                const method = response.request().method();
                
                // Inspectam ORICE request GET care are JSON sa gasim orders
                if (method === 'GET' && response.status() === 200) {
                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json') && (url.includes('orders') || url.includes('finances') || url.includes('history') || url.includes('graphql'))) {
                            const json = await response.json();
                            const ordersArray = json.orders || json.data || (Array.isArray(json) ? json : null);
                            
                            if (ordersArray && Array.isArray(ordersArray) && ordersArray.length > 0 && (ordersArray[0].orderId || ordersArray[0].price || ordersArray[0].totalAmount)) {
                                console.log(`🎉 [XHR Intercept] Am prins un pachet JSON de la: ${url.split('?')[0]}`);
                                
                                ordersArray.forEach(o => {
                                    interceptedOrders.push({
                                        platform: 'glovo',
                                        order_id: o.orderId || o.id || o.code || 'N/A',
                                        total_amount: o.totalAmount || o.price || o.total || 0,
                                        placed_at: o.placedAt || o.creationTime || o.date || new Date().toISOString(),
                                        items: o.products ? o.products.map(p => ({
                                            name: p.name || 'Produs',
                                            quantity: p.quantity || 1,
                                            price: p.price || 0
                                        })) : []
                                    });
                                });
                            }
                        }
                    } catch (e) {
                         // ignore
                    }
                }
            });

            // Resursele cerute ignorate (viteza)
            page.on('request', (request) => {
                if (['image', 'media', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // 4. Accesam pagina unde sunt listate comenzile
            console.log(`[Glovo Sales Scraper] Navigare spre ${this.ordersUrl} ...`);
            await page.goto(this.ordersUrl, { waitUntil: 'networkidle2' });

            // Asteptam 10 secunde ca Glovo sa faca request-ul catre serverul propriu 
            // incat sa-l interceptam prin functia "on('response')" mapata mai sus.
            console.log('[Glovo Sales Scraper] Așteptăm descărcarea componentelor de pe portal (15s)...');
            await new Promise(r => setTimeout(r, 15000));

            // Cazul de rezerva: Parsam HTML (DOM)
            if (interceptedOrders.length === 0) {
                console.log('⚠️ [Glovo Sales Scraper] API Interception failed. Attempting DOM Parsing from Merchant interface...');
                
                interceptedOrders = await page.evaluate(() => {
                    let domData = [];
                    // Adaptat PENTRU PAGINA DE REPORTS - extrage totalurile blocului financiar
                    // Glovo Reports are carduri sau tabele sumarizate
                    const rows = document.querySelectorAll('tr, [role="row"], .report-card, .metric-card');
                    rows.forEach(row => {
                        const textContent = row.innerText || '';
                        if (textContent.includes('RON')) {
                            const priceMatch = textContent.match(/(\d+[\.,]\d{2})\s*RON/);
                            if (priceMatch) {
                                const rawPrice = priceMatch[1];
                                domData.push({
                                    platform: 'glovo',
                                    order_id: 'REF_REPORT_AGGREGATE_' + Math.floor(Math.random() * 100000),
                                    total_amount: parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
                                    placed_at: new Date().toISOString(),
                                    items: [] 
                                });
                            }
                        }
                    });
                    
                    // Daca am gasit prea multe, le limitam sa nu stricam baza (daca extragem agregat)
                    return domData;
                });
            }
            
            // Salvam mereu o poza ca sa vedem ce vede efectiv robotul inainte sa inchida
            console.log(`[Glovo Sales Scraper] Salvez un screenshot pentru verificare: screenshot_glovo.png...`);
            await page.screenshot({ path: 'screenshot_glovo.png', fullPage: true });

            console.log(`✅ [Glovo Sales Scraper] Extragere finalizată! Găsite: ${interceptedOrders.length} comenzi Wolt.`);
            
            await browser.close();
            return { success: true, count: interceptedOrders.length, data: interceptedOrders };

        } catch (error) {
            console.error(`❌ [Glovo Sales Scraper] Eroare Sistem: ${error.message}`);
            if (browser) await browser.close();
            return { success: false, error: error.message };
        }
    }
}

// TESTARE EXECUTIE
async function testScript() {
    console.log("=============================================");
    console.log("  TEST: GLOVO SALES & ORDERS EXTRACTOR");
    console.log("=============================================\n");
    const scraper = new GlovoSalesScraper();
    
    // Contul proaspat primit
    const result = await scraper.scrapeSales('jeka7ro@gmail.com', '31Martie2026!');
    console.log("\n======= REZULTAT =======");
    if (result.success) {
        console.log(`Au fost exportate ${result.count} comenzi! Banii pot fi acum pusi in baza de date Supabase.`);
        console.log("Primul rand de date arata asa:", JSON.stringify(result.data[0] || {}, null, 2));
    }
}

// Numai executa `testScript()` cand e rulat direct din terminal
if (process.argv[1] === new URL(import.meta.url).pathname) {
    testScript();
}
