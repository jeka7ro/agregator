import fetch from 'node-fetch';
import { supabase } from './src/services/supabase.js';

const ENVIRONMENTS = [
    { key: 'a1fe30cdeb934aa0af01b6a35244b7f0', baseUrl: 'https://api-eu.syrve.live/api/1' },
    { key: '124d0880f4b44717b69ee21d45fc2656', baseUrl: 'https://api-eu.syrve.live/api/1' }
];

async function run() {
    const { data: restaurants } = await supabase.from('restaurants').select('*').not('iiko_restaurant_id', 'is', null).limit(5);
    const orgIdsInDb = restaurants.map(r => r.iiko_restaurant_id).filter(Boolean);
    console.log("Orgs:", orgIdsInDb);

    const env = ENVIRONMENTS[0];
    const resAuth = await fetch(`${env.baseUrl}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: env.key })
    });
    const { token } = await resAuth.json();
    console.log("Token:", token.substring(0, 10));

    const resStops = await fetch(`${env.baseUrl}/stop_lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationIds: orgIdsInDb })
    });
    const data = await resStops.text();
    console.log("Stops:", data.substring(0, 500));
    process.exit(0);
}
run();
