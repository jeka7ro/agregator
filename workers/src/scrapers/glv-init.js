import puppeteer from 'puppeteer';
import fs from 'fs';

const GLOVO_USER = 'ion.plamadeala@gmail.com';
const GLOVO_PASS = 'Glovo12345';

async function authAndExtract() {
    console.log("🚀 PORNIRE ROBOT GLOVO: Deschidem Chrome pe calculatorul tau...");
    const browser = await puppeteer.launch({ 
        headless: true,
        defaultViewport: null,
        args: ['--window-size=1280,800', '--no-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        console.log("🔗 Accesare portal Glovo Partners...");
        await page.goto('https://partners.glovoapp.com/login', { waitUntil: 'domcontentloaded' });
        
        console.log("-------------------------------------------------------------------------");
        console.log("⚠️ ATENTIE: Daca vezi un test Cloudflare (Verify you are human), TE ROG BIFEAZA-L MANUAL ACUM!");
        console.log(`🔑 Daca apar casutele, poti lasa robotul sau poti scrie tu (${GLOVO_USER} / ${GLOVO_PASS})`);
        console.log("✅ Te astept 60 de secunde sa te loghezi si sa ajungi pe pagina de pornire (Dashboard)!");
        console.log("-------------------------------------------------------------------------");

        // Try to autofill if possible, but let errors pass if Cloudflare blocks it
        try {
            await page.waitForSelector('input[type="email"], input[name="email"], [data-test-id="email-input"]', { timeout: 15000 });
            await page.type('input[name="email"], input[type="email"]', GLOVO_USER, { delay: 50 }).catch(()=>null);
            await page.type('input[name="password"], input[type="password"]', GLOVO_PASS, { delay: 50 }).catch(()=>null);
            console.log("👆 Am completat. Da tu click pe LOGIN sau apasa Enter!");
        } catch (e) {
            console.log("🤖 Cloudflare a blocat completarea automata. Te rog completeaza si apasa Login manual in fereastra care s-a deschis.");
        }

        console.log("⏳ Robotul pandeste momentul in care intri in Dashboard pentru a extrage cheile secrete...");
        
        // Wait until we reach a URL that signifies the dashboard
        await page.waitForFunction(() => {
            return window.location.href.includes('dashboard') || window.location.href.includes('performance') || window.location.href.includes('orders') || document.body.innerText.includes('Invoices');
        }, { timeout: 90000 });

        console.log("🎉 LOGARE DETECTATA CU SUCCES! Extrag cookies securizate si Token-ul...");
        await new Promise(r => setTimeout(r, 5000)); // lasa platforma sa se incarce complet

        const cookies = await page.cookies();
        fs.writeFileSync('workers/src/scrapers/glovo-cookies.json', JSON.stringify(cookies, null, 2));

        const token = await page.evaluate(() => {
            return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        });

        if (token) {
            fs.writeFileSync('workers/src/scrapers/glovo-token.txt', token);
            console.log("✅ Token API GLOVO extras si salvat in siguranta (glovo-token.txt).");
        } else {
            console.log("⚠️ Nu s-a putut extrage Token API din localStorage, am salvat doar cookies!");
        }
        
        console.log("📊 Extrag cifrele de vanzare rapide de pe ecranul asta sa ti le trimit...");
        const texts = await page.evaluate(() => document.body.innerText.substring(0, 1500));
        console.log(texts);

        await page.screenshot({ path: 'glovo_success.png', fullPage: true });
        console.log("📸 Screenshot de confirmare a logarii reale in Glovo salvat! (glovo_success.png)");
        
    } catch (e) {
        console.error("Eroare GLOVO Auth:", e.message);
    } finally {
        setTimeout(() => browser.close(), 10000); 
    }
}

// authAndExtract() — DEZACTIVAT: se rulează manual din terminal, nu automat
// Ca să rulezi manual: node workers/src/scrapers/glv-init.js
// if (process.argv[1] === new URL(import.meta.url).pathname) authAndExtract();
