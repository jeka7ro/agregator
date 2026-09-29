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
            revision: 0
        })
    });
    let data = await res.json();
    const orders = data.ordersByOrganizations?.[0]?.orders || [];
    console.log("Total orders fetched:", orders.length);
    console.log("Max revision returned:", data.maxRevision);
    if (orders.length > 0) {
        console.log("Oldest order date:", orders[0].order?.creationStatus || orders[0].creationStatus, new Date(orders[0].timestamp).toISOString());
        console.log("Newest order date:", new Date(orders[orders.length-1].timestamp).toISOString());
    }
}
run();
