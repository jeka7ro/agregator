import fetch from 'node-fetch';

async function run() {
    const k = 'a1fe30cdeb934aa0af01b6a35244b7f0';
    const BASE_URL = 'https://api-eu.syrve.live/api/1';
    
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: k })
    });
    const { token } = await resAuth.json();
    
    // test deliveries/by_revision
    console.log("Testing by_revision...");
    let res = await fetch(`${BASE_URL}/deliveries/by_revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
            revision: 0
        })
    });
    let data = await res.json();
    console.log("by_revision:", data.correlationId ? "SUCCESS/HAS DATA" : data.errorDescription || data);

    // test orders/by_open_date (Table orders)
    res = await fetch(`${BASE_URL}/orders/by_open_date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
            openDateFrom: "2026-05-12 00:00:00.000",
            openDateTo: "2026-05-12 23:59:59.000",
        })
    });
    data = await res.json();
    console.log("orders/by_open_date:", data.errorDescription || (data.orders?.[0]?.orders?.length || 0) + " orders");
}
run();
