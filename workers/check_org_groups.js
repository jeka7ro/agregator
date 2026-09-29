import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_KEYS = [
    'a1fe30cdeb934aa0af01b6a35244b7f0',
    '124d0880f4b44717b69ee21d45fc2656',
    '56597d13165c49c49c10e351b5eac617',
    '78a2206d3b9c4e93b9b5a5ee774f69aa'
];

async function checkCatalogs() {
    for (const key of API_KEYS) {
        try {
            const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiLogin: key }) });
            const token = (await resAuth.json()).token;
            if (!token) continue;
            
            const resOrgs = await fetch('https://api-eu.syrve.live/api/1/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ returnAdditionalInfo: true }) });
            const data = await resOrgs.json();
            
            for (const org of (data.organizations || []).slice(0, 5)) {
                const nRes = await fetch('https://api-eu.syrve.live/api/1/nomenclature', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ organizationId: org.id }) });
                if (nRes.ok) {
                    const nData = await nRes.json();
                    const topGroups = (nData.groups || []).filter(g => !g.parentGroup).map(g => g.name);
                    console.log(`Org: ${org.name} -> Top Groups:`, topGroups);
                }
            }
        } catch (e) {}
    }
}

checkCatalogs().catch(console.error);
