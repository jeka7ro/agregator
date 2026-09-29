import fetch from 'node-fetch';
import { supabase } from './src/services/supabase.js';

async function run() {
    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: 'a1fe30cdeb934aa0af01b6a35244b7f0' })
    });
    const { token } = await resAuth.json();
    const resOrgs = await fetch('https://api-eu.syrve.live/api/1/organizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
    });
    const data = await resOrgs.json();
    const rm = data.organizations.find(o => o.name === 'RM TIMISOARA');
    
    if (rm) {
        console.log("Found RM TIMISOARA ID:", rm.id);
        const { error } = await supabase.from('restaurants').insert({
            name: 'RM TIMISOARA', city: 'TIMISOARA', iiko_restaurant_id: rm.id, is_active: false
        });
        console.log("Inserted?", error || "Yes");
    }
}
run();
