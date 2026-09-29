import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import fetch from 'node-fetch';

async function run() {
    const k = 'a1fe30cdeb934aa0af01b6a35244b7f0';
    const resAuth = await fetch('https://api-eu.syrve.live/api/1/access_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: k })
    });
    const { token } = await resAuth.json();
    console.log("Token:", token.substring(0, 10));

    const reqBody = {
        organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
        deliveryDateFrom: "2026-05-20 00:00:00.000",
        deliveryDateTo: "2026-05-20 23:59:59.000",
        statuses: ["Closed"]
    };

    const res = await fetch(`https://api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(reqBody)
    });
    const data = await res.json();
    console.log("Orders:", JSON.stringify(data).substring(0, 500));
}
run();
