import fetch from 'node-fetch';

async function run() {
    const k = 'a1fe30cdeb934aa0af01b6a35244b7f0';
    const BASE_URL = 'https://api-eu.syrve.live/api/1';
    
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: k })
    });
    const { token } = await resAuth.json();
    
    let res = await fetch(`${BASE_URL}/deliveries/by_revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
            revision: 1700000000000 // A revision from ~Nov 2023
        })
    });
    let data = await res.json();
    const orders = data.ordersByOrganizations?.[0]?.orders || [];
    console.log("Fetched orders with rev 1.7T:", orders.length);
    if (orders.length > 0) {
        console.log("Oldest:", orders[0].order?.whenCreated || orders[0].timestamp);
    }
}
run();
