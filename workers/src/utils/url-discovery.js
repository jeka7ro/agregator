import puppeteer from 'puppeteer'

const GLOVO_CITIES = ['bucuresti', 'cluj-napoca', 'timisoara', 'iasi', 'brasov', 'constanta', 'craiova', 'galati', 'ploiesti', 'oradea']
const WOLT_CITIES = ['bucharest', 'cluj-napoca', 'timisoara', 'iasi', 'brasov']
const BOLT_CITIES = ['bucharest', 'cluj', 'timisoara', 'iasi', 'brasov']

function matchesBrand(text) {
    const normalized = text.toLowerCase()
    return normalized.includes('sushi master') || normalized.includes('sushimaster')
}

function dedupeByUrl(records) {
    const seen = new Set()
    return records.filter(record => {
        if (seen.has(record.url)) return false
        seen.add(record.url)
        return true
    })
}

async function scrapeGlovo(page) {
    const records = []

    for (const city of GLOVO_CITIES) {
        const source = `https://glovoapp.com/ro/ro/${city}/search/?q=sushi%20master`

        try {
            console.log(`🔍 Scraping Glovo in ${city}...`)

            await page.goto(source, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            })

            // Wait for initial load
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Scroll to load results
            for (let i = 0; i < 10; i++) {
                await page.mouse.wheel({ deltaY: 1800 })
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            // Extract links
            const links = await page.evaluate(() => {
                const results = []
                const anchors = document.querySelectorAll('a[href]')

                anchors.forEach(a => {
                    const href = a.getAttribute('href')
                    const text = a.textContent.trim()

                    if (href && href.includes('/stores/')) {
                        const fullUrl = href.startsWith('/')
                            ? `https://glovoapp.com${href}`
                            : href

                        results.push({
                            href: fullUrl.split('?')[0],
                            text: text
                        })
                    }
                })

                return results
            })

            // Filter for Sushi Master
            links.forEach(link => {
                if (matchesBrand(link.text + ' ' + link.href)) {
                    records.push({
                        platform: 'glovo',
                        country: 'ro',
                        city: city,
                        name: link.text || 'Sushi Master',
                        url: link.href,
                        source_page: source,
                        scraped_at: new Date().toISOString()
                    })
                }
            })

            console.log(`   Found ${links.filter(l => matchesBrand(l.text + ' ' + l.href)).length} results`)

        } catch (error) {
            console.error(`   ❌ Error scraping ${city}:`, error.message)
        }
    }

    return dedupeByUrl(records)
}

async function scrapeWolt(page) {
    const records = []

    for (const city of WOLT_CITIES) {
        const source = `https://wolt.com/ro/rou/${city}/search?q=sushi%20master`

        try {
            console.log(`🔍 Scraping Wolt in ${city}...`)

            await page.goto(source, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            })

            await new Promise(resolve => setTimeout(resolve, 3000))

            // Scroll to load results
            for (let i = 0; i < 10; i++) {
                await page.mouse.wheel({ deltaY: 1800 })
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            const links = await page.evaluate(() => {
                const results = []
                const anchors = document.querySelectorAll('a[href]')

                anchors.forEach(a => {
                    const href = a.getAttribute('href')
                    const text = a.textContent.trim()

                    if (href && (href.includes('/venue/') || href.includes('/restaurant/'))) {
                        const fullUrl = href.startsWith('/')
                            ? `https://wolt.com${href}`
                            : href

                        results.push({
                            href: fullUrl.split('?')[0],
                            text: text
                        })
                    }
                })

                return results
            })

            links.forEach(link => {
                if (matchesBrand(link.text + ' ' + link.href)) {
                    records.push({
                        platform: 'wolt',
                        country: 'ro',
                        city: city,
                        name: link.text || 'Sushi Master',
                        url: link.href,
                        source_page: source,
                        scraped_at: new Date().toISOString()
                    })
                }
            })

            console.log(`   Found ${links.filter(l => matchesBrand(l.text + ' ' + l.href)).length} results`)

        } catch (error) {
            console.error(`   ❌ Error scraping ${city}:`, error.message)
        }
    }

    return dedupeByUrl(records)
}

async function scrapeBolt(page) {
    const records = []

    for (const city of BOLT_CITIES) {
        const source = `https://food.bolt.eu/ro-RO/${city}/search/?q=sushi%20master`

        try {
            console.log(`🔍 Scraping Bolt in ${city}...`)

            await page.goto(source, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            })

            await new Promise(resolve => setTimeout(resolve, 3000))

            // Scroll to load results
            for (let i = 0; i < 10; i++) {
                await page.mouse.wheel({ deltaY: 1800 })
                await new Promise(resolve => setTimeout(resolve, 500))
            }

            const links = await page.evaluate(() => {
                const results = []
                const anchors = document.querySelectorAll('a[href]')

                anchors.forEach(a => {
                    const href = a.getAttribute('href')
                    const text = a.textContent.trim()

                    if (href && href.includes('/restaurant/')) {
                        const fullUrl = href.startsWith('/')
                            ? `https://food.bolt.eu${href}`
                            : href

                        results.push({
                            href: fullUrl.split('?')[0],
                            text: text
                        })
                    }
                })

                return results
            })

            links.forEach(link => {
                if (matchesBrand(link.text + ' ' + link.href)) {
                    records.push({
                        platform: 'bolt',
                        country: 'ro',
                        city: city,
                        name: link.text || 'Sushi Master',
                        url: link.href,
                        source_page: source,
                        scraped_at: new Date().toISOString()
                    })
                }
            })

            console.log(`   Found ${links.filter(l => matchesBrand(l.text + ' ' + l.href)).length} results`)

        } catch (error) {
            console.error(`   ❌ Error scraping ${city}:`, error.message)
        }
    }

    return dedupeByUrl(records)
}

export async function discoverUrls() {
    console.log('🚀 Starting URL Discovery for Sushi Master restaurants...\n')

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()]
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

    const allRecords = []

    // Scrape all platforms
    const glovoRecords = await scrapeGlovo(page)
    allRecords.push(...glovoRecords)
    console.log(`\n✅ Glovo: Found ${glovoRecords.length} unique URLs\n`)

    const woltRecords = await scrapeWolt(page)
    allRecords.push(...woltRecords)
    console.log(`\n✅ Wolt: Found ${woltRecords.length} unique URLs\n`)

    const boltRecords = await scrapeBolt(page)
    allRecords.push(...boltRecords)
    console.log(`\n✅ Bolt: Found ${boltRecords.length} unique URLs\n`)

    await browser.close()

    console.log(`\n🎉 Total: Found ${allRecords.length} restaurant URLs across all platforms`)

    return allRecords
}
