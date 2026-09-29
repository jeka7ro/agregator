const auth = async () => {
    try {
        const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: '78a2206d3b9c4e93b9b5a5ee774f69aa' })
        });
        const d_t = await tokenRes.json();
        const token = d_t.token;
        
        const orgId = "adddb5a0-26e5-4d50-b472-1c74726c3f72"; // SM BRASOV

        // Get Stop List
        const stopRes = await fetch('https://api-eu.syrve.live/api/1/stop_lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ organizationIds: [orgId] })
        });
        const stopData = await stopRes.json();
        
        // Also get nomenclature to map IDs to names
        const nomRes = await fetch('https://api-eu.syrve.live/api/1/nomenclature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ organizationId: orgId })
        });
        const nomData = await nomRes.json();
        const prodMap = {};
        if (nomData.products) {
             nomData.products.forEach(p => { prodMap[p.id] = p.name; });
        }
        
        console.log("=== Syrve Stop List (Brașov) ===");
        if (stopData.terminalGroupStopLists && stopData.terminalGroupStopLists.length > 0) {
            stopData.terminalGroupStopLists.forEach(tg => {
                 const items = tg.items || [];
                 if (items.length === 0) {
                      console.log("No items on stop list for terminal", tg.terminalGroupId);
                      return;
                 }
                 items.forEach(item => {
                      console.log("- Out of stock:", prodMap[item.productId] || item.productId);
                 });
            });
        } else {
             console.log("No active stop lists found in Syrve/iiko for this org.");
        }
    } catch (e) {
        console.error(e);
    }
};
auth();
