import puppeteer from 'puppeteer';

export class WoltSalesScraper {
    constructor() {
        this.loginUrl = 'https://merchant.wolt.com/app/login';
        this.ordersUrl = 'https://merchant.wolt.com/app/finances'; // Sau /app/orders în funcție de structura Wolt Merchant
    }

    async scrapeSales(username, password) {
        console.log(`[Wolt Sales Scraper] Inițiere browser pentru Wolt Merchant: ${username}`);
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                defaultViewport: null,
                args: ['--no-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            console.log(`[Wolt Sales Scraper] Accesare portal de autentificare Wolt...`);
            await page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

            // 1. Email
            console.log(`[Wolt Sales Scraper] Introducere email: ${username}`);
            await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
            await page.type('input[type="email"], input[name="email"]', username, { delay: 100 });
            
            const submitEmailBtn = await page.$('button[type="submit"], button[data-test-id="next-button"]');
            if (submitEmailBtn) await submitEmailBtn.click();
            else await page.keyboard.press('Enter');

            await new Promise(r => setTimeout(r, 2000));

            // Wolt folosește des Magic Links pe email, deci verificam asta:
            const pageUrl = page.url();
            if (pageUrl.includes('verify') || pageUrl.includes('magic-link') || await page.$('text/Magic link')) {
                console.log(`⚠️ ALERTA WOLT AUTH: Wolt a trimis un Magic Link către emailul tău (${username}).`);
                console.log(`Așteptăm până la 2 minute să dai click pe linkul din email-ul tău pentru a prinde sesiunea automată...`);
                // Așteptăm redirectul automat odată ce linkul a fost validat
                await page.waitForFunction(() => !window.location.href.includes('login'), { timeout: 120000 });
                console.log(`✅ Magic Link validat! Suntem în contul Wolt.`);
            } else {
                // Posibil flow cu parola existenta
                try {
                    const passInput = await page.$('input[type="password"]');
                    if (passInput) {
                        console.log(`[Wolt Sales Scraper] Introducere parola Wolt...`);
                        await page.type('input[type="password"]', password, { delay: 100 });
                        await page.keyboard.press('Enter');
                        await new Promise(r => setTimeout(r, 3000));
                    }
                } catch(e) {}
            }

            // ====== INTERCEPTIE NETWORK PENTRU WOLT ======
            // Vânăm requesturile către serverele Wolt care conțin JSON cu ordine financiare
            console.log(`[Wolt Sales Scraper] Activare interceptare API intern pentru extragerea Comenzilor Reale (Bani)...`);
            
            let interceptedWoltOrders = [];
            
            await page.setRequestInterception(true);
            page.on('response', async (response) => {
                const url = response.url();
                // Extragem din requesturile de /orders sau similar de la API-ul Wolt
                if ((url.includes('/orders') || url.includes('/finances')) && response.request().method() === 'GET' && response.status() === 200) {
                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            const json = await response.json();
                            
                            // Adjustare logică la structura specifică Wolt
                            const ordersArray = json.items || json.orders || (Array.isArray(json) ? json : null);
                            
                            if (ordersArray) {
                                console.log(`🎉 [XHR Intercept] Am capturat JSON-ul financiar de la Wolt!`);
                                ordersArray.forEach(o => {
                                    // Parsează JSON-ul specific Wolt și pregătește obiectul pt Supabase platform_sales
                                    interceptedWoltOrders.push({
                                        platform: 'wolt',
                                        order_id: o.id || o.order_number || 'N/A',
                                        total_amount: o.total_price ? (o.total_price / 100) : (o.price || 0), // Wolt tine des in centi
                                        placed_at: o.created_at || o.time || new Date().toISOString(),
                                        items: o.items ? o.items.map(p => ({
                                            name: p.name || 'Produs',
                                            quantity: p.count || p.quantity || 1,
                                            price: p.price ? (p.price / 100) : 0
                                        })) : []
                                    });
                                });
                            }
                        }
                    } catch (e) {
                         // Nu este JSON
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

            // Navigare spre secțiunea Financiară sau Comenzi
            console.log(`[Wolt Sales Scraper] Navigare spre panoul financiar Wolt: ${this.ordersUrl}`);
            await page.goto(this.ordersUrl, { waitUntil: 'networkidle2' });

            // Așteptăm să se decoleze request-ul de la frontend către serverul Wolt
            console.log('[Wolt Sales Scraper] Așteptăm ca portalul să descarce istoricul de vânzări...');
            await new Promise(r => setTimeout(r, 10000));

            // Dacă interceptarea JSON nu a produs date, aplicăm un DOM Scrape de rezervă (Fallback)
            if (interceptedWoltOrders.length === 0) {
                console.log('⚠️ [Wolt Sales Scraper] API Interception failed. Attempting DOM Parsing from Merchant interface...');
                
                interceptedWoltOrders = await page.evaluate(() => {
                    let domData = [];
                    // Adaptare selectori după structura reală prezentă în DOM la Wolt Merchant
                    const rows = document.querySelectorAll('tr[data-test-id="order-row"], .order-list-item');
                    rows.forEach(row => {
                        const rawPrice = row.querySelector('[data-test-id="order-price"], .price')?.innerText || '0';
                        const oId = row.querySelector('[data-test-id="order-number"], .id')?.innerText || 'N/A';
                        const time = row.querySelector('[data-test-id="order-time"], .time')?.innerText || new Date().toISOString();
                        
                        domData.push({
                            platform: 'wolt',
                            order_id: oId,
                            total_amount: parseFloat(rawPrice.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
                            placed_at: time,
                            items: [] 
                        });
                    });
                    return domData;
                });
            }

            console.log(`✅ [Wolt Sales Scraper] Extragere finalizată! Găsite: ${interceptedWoltOrders.length} comenzi Wolt.`);
            
            await browser.close();
            return { success: true, count: interceptedWoltOrders.length, data: interceptedWoltOrders };

        } catch (error) {
            console.error(`❌ [Wolt Sales Scraper] Eroare fatala de scraping: ${error.message}`);
            if (browser) await browser.close();
            return { success: false, error: error.message };
        }
    }
}

// TESTARE EXECUTIE
async function testWoltScript() {
    console.log("=============================================");
    console.log("  TEST: WOLT SALES & ORDERS EXTRACTOR");
    console.log("=============================================\n");
    const scraper = new WoltSalesScraper();
    
    // Contul proaspat primit
    const result = await scraper.scrapeSales('jeka7ro@gmail.com', '31Martie2026!');
    console.log("\n======= REZULTAT WOLT =======");
    if (result.success) {
        console.log(`S-au exportat ${result.count} comenzi financiare Wolt!`);
        console.log("Prima comanda interceptata (Bani & Produse):", JSON.stringify(result.data[0] || {}, null, 2));
    }
}

// Numai executa `testWoltScript()` cand e rulat direct din terminal
if (process.argv[1] === new URL(import.meta.url).pathname) {
    testWoltScript();
}
