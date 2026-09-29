import fetch from 'node-fetch';

const ENV_CONFIGS = [
    { key: 'a1fe30cdeb934aa0af01b6a35244b7f0', baseUrl: 'https://api-eu.syrve.live/api/1' },
    { key: '124d0880f4b44717b69ee21d45fc2656', baseUrl: 'https://api-eu.syrve.live/api/1' }
];

async function run() {
    for (const env of ENV_CONFIGS) {
        const resAuth = await fetch(`${env.baseUrl}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: env.key })
        });
        const { token } = await resAuth.json();
        const resOrgs = await fetch(`${env.baseUrl}/organizations`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({})
        });
        const data = await resOrgs.json();
        const orgs = data.organizations || [];
        const ikuraOrgs = orgs.filter(o => o.name.toLowerCase().includes('ikura') || o.name.toLowerCase().includes('sushi master') || o.name.includes('RM '));
        console.log(`Env ${env.key.substring(0,5)} found:`, ikuraOrgs.map(o => o.name));
    }
}
run();
