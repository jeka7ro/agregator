import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
import fetch from 'node-fetch';

async function run() {
    const API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
    const BASE_URL = 'https://api-eu.syrve.live/api/1';
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const token = (await resAuth.json()).token;

    const orgId = "effc9518-ceef-4eec-8ad5-9b48ae84c540";
    console.log("Cerem OLAP Sales for 11.05...");
    const olapRes = await fetch(`${BASE_URL}/reports/sales`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationId: orgId,
            request: {
                reportType: "SALES",
                buildSummary: false,
                groupByRowLabels: [ "OrderId", "OrderExternalNumber", "OpenTime", "OrderType", "Delivery.Type", "OrderSource" ],
                aggregateFields: [ "DishDiscountSumInt" ],
                filters: {
                    "OpenDate.Typed": { "filterType": "IncludeValues", "values": ["2026-05-11"] }
                }
            }
        })
    });
    const olapTask = await olapRes.json();
    console.log("Task creat:", olapTask);

    if (olapTask.correlationId) {
        let status = 'IN_PROGRESS';
        while (status === 'IN_PROGRESS') {
            await new Promise(r => setTimeout(r, 2000));
            const sRes = await fetch(`${BASE_URL}/reports/sales/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ correlationId: olapTask.correlationId, organizationId: orgId })
            });
            const sData = await sRes.json();
            status = sData.state;
            if (status === 'SUCCESS') {
                console.log("GATA OLAP. Randuri primite:", sData.data?.length || sData);
                if (sData.data && sData.data.length > 0) {
                    console.log("Exemplu:", JSON.stringify(sData.data[0]));
                }
            } else if (status === 'ERROR') {
                console.error("Eroare OLAP:", sData);
                break;
            }
        }
    }
}
run();
