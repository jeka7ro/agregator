import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: 'workers/.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const KEYS = [
    { login: '56597d13165c49c49c10e351b5eac617', brandPrefixes: ['sushi master', 'we love sushi', 'ikura'] },
    { login: '124d0880f4b44717b69ee21d45fc2656', brandPrefixes: ['smash me'] }
];

async function run() {
    let updateCount = 0;
    
    // get all active restaurants
    const { data: restaurants } = await supabase.from('restaurants').select('id, name, city');
    
    for (const keyDef of KEYS) {
        const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: keyDef.login })
        });
        if (!tokenRes.ok) continue;
        const { token } = await tokenRes.json();
        
        const orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ organizationIds: [], returnAdditionalInfo: true, includeDisabled: false })
        });
        const { organizations } = await orgsRes.json();
        
        for (const org of organizations) {
            const srchName = org.name.toLowerCase();
            
            // For each organization in Syrve (e.g., "SM BRASOV"), it might match MULTIPLE restaurants in DB
            // (e.g., "Sushi Master Brasov" AND "We Love Sushi Brasov").
            let matchedRests = [];
            
            for (const rest of restaurants) {
                const restName = rest.name.toLowerCase();
                const restCity = (rest.city || '').toLowerCase();
                
                // if it's the SM/WLS key
                if (keyDef.login === '56597d13165c49c49c10e351b5eac617') {
                    // Match by city
                    let cityFromSyrve = srchName.replace('sm ', '').replace('ikura ', '').trim();
                    if (cityFromSyrve.includes('buc ')) {
                         if (srchName.includes('titan') && restName.includes('titan')) matchedRests.push(rest);
                         if (srchName.includes('unirii') && restName.includes('unirii')) matchedRests.push(rest);
                         if (srchName.includes('cora') && restName.includes('cora')) matchedRests.push(rest);
                         if (srchName.includes('ceaikovski') && restName.includes('ceaikovski')) matchedRests.push(rest);
                    } else if (restCity && cityFromSyrve.includes(restCity)) {
                         // Check if the restaurant is SM, WLS, or Ikura
                         if (restName.includes('sushi master') || restName.includes('we love sushi') || restName.includes('ikura')) {
                              matchedRests.push(rest);
                         }
                    } else if (restName.includes('targu mures') && srchName.includes('targu mures')) {
                         matchedRests.push(rest);
                    }
                } 
                // if it's the Smash key
                else if (keyDef.login === '124d0880f4b44717b69ee21d45fc2656') {
                    if (restName.includes('smash me') && srchName.includes(restCity)) {
                        matchedRests.push(rest);
                    }
                }
            }
            
            for (const match of matchedRests) {
                console.log(`Matched Syrve [${org.name}] ---> DB [${match.name}]`);
                const conf = {
                     api_url: 'https://api-eu.syrve.live',
                     api_login: keyDef.login,
                     organization_id: org.id
                };
                await supabase.from('restaurants').update({ iiko_config: conf }).eq('id', match.id);
                updateCount++;
            }
        }
    }
    console.log(`\n✅ Linked a total of ${updateCount} restaurants to Syrve/POS.`);
}

run();
