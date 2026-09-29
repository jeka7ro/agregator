import puppeteer from 'puppeteer';

const GLOVO_USER = 'ion.plamadeala@gmail.com';
const GLOVO_PASS = 'Glovo12345';

async function authAndExtract() {
    console.log("🚀 ROBOT GLOVO: Se porneste instanta Google Chrome...");
    const browser = await puppeteer.launch({ 
        headless: true,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
    });
    
    try {
        const page = await browser.newPage();
        
        console.log("🔗 Accesare portalul Glovo Partners...");
        await page.goto('https://partners.glovoapp.com/login', { waitUntil: 'networkidle2' });
        
        // 1. Enter Credentials
        console.log("🔑 Autompletare credențiale...");
        await page.waitForSelector('input[name="email"]', { timeout: 10000 });
        await page.type('input[name="email"]', GLOVO_USER, { delay: 50 });
        await page.type('input[name="password"]', GLOVO_PASS, { delay: 50 });
        
        console.log("👆 Apasare buton Login...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
            page.keyboard.press('Enter')
        ]);
        
        console.log("⏳ Asteptam 5 secunde sa se incarce datele financiare reale pe dashboard...");
        await new Promise(r => setTimeout(r, 5000));
        
        // Take a screenshot to prove we logged in
        await page.screenshot({ path: 'glovo_dash.png', fullPage: true });
        console.log("📸 Screenshot salvat local ca 'glovo_dash.png' ! Trage-l in chat sa analizam structura vizuala la perfectiune!");
        
        // Grab some basic text to debug
        const innerText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
        console.log("📄 O parte din textul gasit direct pe Dashboard-ul vostru Glovo:");
        console.log(innerText);
        
        console.log("\n✅ Runda 1 / Faza A: TEST DE AUTENTIFICARE CU SUCCES! Te rog inchide fereastra Chromium acum.");
    } catch (e) {
        console.error("Eroare Robot:", e);
    } finally {
        setTimeout(() => browser.close(), 10000); // inchidere automata dupa 10s
    }
}

// authAndExtract() — DEZACTIVAT: nu se mai rulează automat
// Rulează manual: node workers/src/scrapers/glovo-crawler-phase1.js
