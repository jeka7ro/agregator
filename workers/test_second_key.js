import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import fetch from 'node-fetch';

async function run() {
    const keys = ['a1fe30cdeb934aa0af01b6a35244b7f0', '124d0880f4b44717b69ee21d45fc2656'];
    const BASE_URL = 'https://api-eu.syrve.live/api/1';
    
    for (const k of keys) {
        console.log("Testing key:", k.substring(0,6));
        const resAuth = await fetch(`${BASE_URL}/access_token`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: k })
        });
        const { token } = await resAuth.json();
        
        // test deliveries 12.05
        const reqBody = {
            organizationIds: ["effc9518-ceef-4eec-8ad5-9b48ae84c540"],
            deliveryDateFrom: "2026-05-12 00:00:00.000",
            deliveryDateTo: "2026-05-12 23:59:59.000",
            statuses: ["Closed"]
        };
        const res = await fetch(`${BASE_URL}/deliveries/by_delivery_date_and_status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(reqBody)
        });
        const data = await res.json();
        console.log("  Deliveries 12.05:", data.ordersByOrganizations?.[0]?.orders?.length || 0);

        // test olap
        const olapRes = await fetch(`${BASE_URL}/reports/sales`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                organizationId: "effc9518-ceef-4eec-8ad5-9b48ae84c540",
                request: { reportType: "SALES", buildSummary: false, groupByRowLabels: [ "OrderId" ], aggregateFields: [ "DishDiscountSumInt" ], filters: { "OpenDate.Typed": { "filterType": "IncludeValues", "values": ["2026-05-11"] } } }
            })
        });
        const olapTask = await olapRes.json();
        console.log("  OLAP Error:", olapTask.errorDescription || "NO ERROR");
    }
}
run();
