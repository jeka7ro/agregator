import fetch from 'node-fetch';

const API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.iiko.services/api/1';

async function testOlap() {
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const token = (await resAuth.json()).token;

    const resOrgs = await fetch(`${BASE_URL}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
    });
    const org = (await resOrgs.json()).organizations[0];
    console.log("Testezi org:", org.name);

    // Prepare dates for OLAP (e.g. 2026-03-31)
    const d = new Date(); d.setDate(d.getDate() - 1);
    const dateStr = d.toISOString().split('T')[0];

    // Request OLAP
    console.log("Cerem OLAP Sales...");
    const olapRes = await fetch(`${BASE_URL}/reports/sales`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            organizationId: org.id,
            request: {
                reportType: "SALES",
                buildSummary: false,
                groupByRowLabels: [ "OpenDate.Typed", "HourOpen", "OrderType" ],
                aggregateFields: [ "DishDiscountSumInt.format" ],
                filters: {
                    "OpenDate.Typed": { "filterType": "IncludeValues", "values": [dateStr] }
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
            console.log("Polling status...");
            const sRes = await fetch(`${BASE_URL}/reports/sales/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ correlationId: olapTask.correlationId, organizationId: org.id })
            });
            const sData = await sRes.json();
            status = sData.state;
            if (status === 'SUCCESS') {
                console.log("GATA OLAP. Randuri primite:", sData.data?.length || sData);
            } else if (status === 'ERROR') {
                console.error("Eroare OLAP:", sData);
                break;
            }
        }
    }
}

testOlap().catch(console.error);
