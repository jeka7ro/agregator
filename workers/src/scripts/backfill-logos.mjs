/**
 * Backfill logo_url for competitor_restaurants where logo_url IS NULL
 * Uses Wolt API with city coordinates to fetch fresh logo URLs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
    readFileSync('/Users/eugeniucazmal/dev/aggregator-monitor-fba2535a/workers/.env', 'utf8')
        .split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim()))
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

const CITY_COORDS = {
    'Bucharest': { lat: 44.4268, lon: 26.1025 }, 'Cluj-Napoca': { lat: 46.7712, lon: 23.6236 },
    'Timisoara': { lat: 45.7489, lon: 21.2087 }, 'Iasi': { lat: 47.1585, lon: 27.6014 },
    'Constanta': { lat: 44.1733, lon: 28.6383 }, 'Brasov': { lat: 45.6427, lon: 25.5887 },
    'Galati': { lat: 45.4353, lon: 28.0080 }, 'Sibiu': { lat: 45.7983, lon: 24.1256 },
    'Ploiesti': { lat: 44.9451, lon: 26.0147 }, 'Bacau': { lat: 46.5670, lon: 26.9146 },
    'Targu Mures': { lat: 46.5386, lon: 24.5544 }, 'Braila': { lat: 45.2692, lon: 27.9574 },
    'Baia Mare': { lat: 47.6669, lon: 23.5847 },
}

async function fetchWoltLogos(city) {
    const coords = CITY_COORDS[city]
    if (!coords) return {}
    try {
        const res = await fetch(
            `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${coords.lat}&lon=${coords.lon}`,
            { headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' } }
        )
        if (!res.ok) return {}
        const d = await res.json()
        const venSection = d.sections?.find(s => s.name === 'restaurants-delivering-venues')
        const allVenues = venSection?.items || []
        const map = {}
        allVenues.forEach(item => {
            if (item.venue?.name && item.venue?.brand_image?.url) {
                map[item.venue.name.toLowerCase()] = item.venue.brand_image.url
            }
        })
        return map
    } catch { return {} }
}

async function main() {
    console.log('🔄 Fetching restaurants without logos...')
    const { data: restaurants } = await supabase
        .from('competitor_restaurants')
        .select('id, name, competitor_snapshots(city)')
        .is('logo_url', null)
        .limit(2000)

    if (!restaurants?.length) { console.log('✅ All logos already filled!'); return }
    console.log(`Found ${restaurants.length} restaurants without logos`)

    // Group by city
    const byCity = {}
    restaurants.forEach(r => {
        const city = r.competitor_snapshots?.city
        if (!city) return
        if (!byCity[city]) byCity[city] = []
        byCity[city].push(r)
    })

    let updated = 0
    for (const [city, rests] of Object.entries(byCity)) {
        console.log(`\n📍 ${city}: ${rests.length} restaurants`)
        const logoMap = await fetchWoltLogos(city)

        for (const r of rests) {
            const logo = logoMap[r.name?.toLowerCase()]
            if (logo) {
                await supabase.from('competitor_restaurants').update({ logo_url: logo }).eq('id', r.id)
                updated++
                process.stdout.write('.')
            }
        }
        await new Promise(r => setTimeout(r, 500)) // rate limit
    }

    console.log(`\n✅ Updated ${updated} logo URLs`)
}

main().catch(console.error)
