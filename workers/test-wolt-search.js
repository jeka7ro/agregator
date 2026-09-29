import fetch from 'node-fetch';

const CITY_COORDS = {
    'Bucharest':   { lat: 44.4268, lng: 26.1025 },
    'Cluj-Napoca': { lat: 46.7712, lng: 23.6236 },
    'Timisoara':   { lat: 45.7489, lng: 21.2087 },
    'Iasi':        { lat: 47.1585, lng: 27.6014 },
    'Constanta':   { lat: 44.1598, lng: 28.6348 },
    'Brasov':      { lat: 45.6427, lng: 25.5887 },
    'Galati':      { lat: 45.4353, lng: 28.0080 },
    'Sibiu':       { lat: 45.7983, lng: 24.1256 },
    'Pitesti':     { lat: 44.8565, lng: 24.8692 },
    'Ploiesti':    { lat: 44.9401, lng: 26.0218 },
    'Bacau':       { lat: 46.5670, lng: 26.9146 },
    'Suceava':     { lat: 47.6515, lng: 26.2555 },
    'Targu Mures': { lat: 46.5386, lng: 24.5578 },
    'Braila':      { lat: 45.2692, lng: 27.9574 },
    'Baia Mare':   { lat: 47.6567, lng: 23.5849 },
    'Craiova':     { lat: 44.3302, lng: 23.7949 },
    'Oradea':      { lat: 47.0722, lng: 21.9218 },
    'Arad':        { lat: 46.1667, lng: 21.3167 },
    'Piatra Neamt':{ lat: 46.9283, lng: 26.3705 }
};

async function testWolt(city, brandName) {
    const c = CITY_COORDS[city];
    if (!c) { console.log('No coords for', city); return; }
    
    const url = `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${c.lat}&lon=${c.lng}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' } });
    if (!res.ok) { console.log('Wolt fail', res.status); return; }
    
    const d = await res.json();
    const venSection = d.sections?.find(s => s.name === 'restaurants-delivering-venues');
    const allVenues = venSection?.items || [];
    
    const match = allVenues.find(item => {
        const name = (item.venue?.name || '').toLowerCase();
        return name.includes(brandName.toLowerCase());
    });
    
    if (match) {
        console.log(`[Wolt] ${city} -> ${match.venue.name} -> https://wolt.com/ro/rou/${city.toLowerCase().replace(/\s+/g,'-')}/restaurant/${match.venue.slug}`);
    } else {
        console.log(`[Wolt] ${city} -> ${brandName} -> Not found (from ${allVenues.length} total)`);
    }
}

testWolt('Piatra Neamt', 'Roll Master');
testWolt('Oradea', 'Ikura');
testWolt('Suceava', 'Poki Woki');
