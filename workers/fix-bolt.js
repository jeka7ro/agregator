import fetch from 'node-fetch';
import { supabase } from './src/services/supabase.js';

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
    'Piatra Neamt':{ lat: 46.9283, lng: 26.3705 },
    'Tulcea':      { lat: 45.1764, lng: 28.7904 },
    'Botosani':    { lat: 47.7408, lng: 26.6669 }
};

const CITY_MAPPINGS = [
    { match: 'BUC', name: 'Bucharest' },
    { match: 'IASI', name: 'Iasi' },
    { match: 'SIBIU', name: 'Sibiu' },
    { match: 'CONSTANTA', name: 'Constanta' },
    { match: 'CLUJ', name: 'Cluj-Napoca' },
    { match: 'TIMISOARA', name: 'Timisoara' },
    { match: 'BRASOV', name: 'Brasov' },
    { match: 'GALATI', name: 'Galati' },
    { match: 'PITESTI', name: 'Pitesti' },
    { match: 'PLOIESTI', name: 'Ploiesti' },
    { match: 'BACAU', name: 'Bacau' },
    { match: 'SUCEAVA', name: 'Suceava' },
    { match: 'MURES', name: 'Targu Mures' },
    { match: 'BRAILA', name: 'Braila' },
    { match: 'BAIA', name: 'Baia Mare' },
    { match: 'CRAIOVA', name: 'Craiova' },
    { match: 'ORADEA', name: 'Oradea' },
    { match: 'ARAD', name: 'Arad' },
    { match: 'NEAMT', name: 'Piatra Neamt' },
    { match: 'TULCEA', name: 'Tulcea' },
    { match: 'BOTOSANI', name: 'Botosani' }
];

async function run() {
    console.log("Checking Bolt...");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city, bolt_url').eq('is_active', true);
    let updated = 0;

    for (const rest of restaurants) {
        if (rest.bolt_url) continue;

        const brandMatch = rest.name.match(/\((.*?)\)/);
        const brandName = brandMatch ? brandMatch[1] : rest.name;
        
        const upperCity = rest.city.toUpperCase();
        let mapping = CITY_MAPPINGS.find(m => upperCity.includes(m.match));
        if (!mapping) continue;
        
        const coords = CITY_COORDS[mapping.name];
        if (!coords) continue;

        try {
            const bBody = {
                "jsonrpc": "2.0", "method": "getProvidersList", "id": "1",
                "params": {
                    "search_query": brandName,
                    "location": { "lat": coords.lat, "lng": coords.lng },
                    "search_type": "text", "session_id": "test_sess_123"
                }
            };
            
            const bRes = await fetch("https://api.bolt.eu/front/eater/getProvidersList", {
                method: "POST", headers: { "Content-Type": "application/json", "Accept-Language": "ro-RO" },
                body: JSON.stringify(bBody)
            });
            const bData = await bRes.json();
            const providers = bData?.data?.providers || [];
            
            const match = providers.find(p => p.name.toLowerCase().includes(brandName.toLowerCase()));
            if (match) {
                console.log(`[Bolt] Found ${rest.name}: https://food.bolt.eu/ro-RO/1-bucharest/p/${match.id}`);
                await supabase.from('restaurants').update({ bolt_url: `https://food.bolt.eu/ro-RO/1-bucharest/p/${match.id}` }).eq('id', rest.id);
                updated++;
            }
        } catch (e) {
            console.error("Bolt Error:", e.message);
        }
    }
    console.log("Bolt updated:", updated);
    process.exit(0);
}

run();
