import fetch from 'node-fetch';

const CITY_COORDS = { 'Bucharest': { lat: 44.4268, lon: 26.1025 } };

async function woltSearch(brandName) {
    const coords = CITY_COORDS['Bucharest'];
    const res = await fetch(`https://restaurant-api.wolt.com/v1/pages/search?q=${encodeURIComponent(brandName)}&lat=${coords.lat}&lon=${coords.lon}`, {
        headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' }
    });
    if(!res.ok) { console.log(res.status); return; }
    const d = await res.json();
    const venues = d.sections?.find(s => s.name === 'venues-search-results')?.items || [];
    const v = venues[0]?.venue;
    if (v) console.log(`Wolt found: ${v.name} -> https://wolt.com/ro/rou/bucharest/restaurant/${v.slug}`);
}

woltSearch('We Love Sushi');
