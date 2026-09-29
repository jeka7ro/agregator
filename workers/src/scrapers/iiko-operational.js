import fetch from 'node-fetch';

const API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const BASE_URL = 'https://api-eu.iiko.services/api/1';

async function fetchOperationalData() {
    console.log("🚀 Ma conectez la iiko cu permisiunile curente...");
    // 1. Auth
    const resAuth = await fetch(`${BASE_URL}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: API_KEY })
    });
    const { token } = await resAuth.json();
    if (!token) throw new Error("A picat autentificarea cu cheia iiko.");

    // 2. Orgs
    const resOrgs = await fetch(`${BASE_URL}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
    });
    const { organizations } = await resOrgs.json();
    const orgIds = organizations.map(o => o.id);
    console.log(`✅ SUCCES: Am extras instant structura celor ${orgIds.length} restaurante/organizații active.`);

    // 3. Stop lists
    console.log(`\n📦 Verific LIVE stop-list-urile (produsele trecute ca "lipsă/oprite" în casă) pentru toate cele ${orgIds.length} de locații...`);
    const resStops = await fetch(`${BASE_URL}/stop_lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationIds: orgIds })
    });
    
    if (resStops.status !== 200) {
        console.log("Eroare stop lists:", await resStops.text());
        return;
    }

    const { terminalGroupStopLists } = await resStops.json();
    let totalStopped = 0;
    
    if (terminalGroupStopLists && terminalGroupStopLists.length > 0) {
        for (const group of terminalGroupStopLists) {
            const orgName = organizations.find(o => o.id === group.organizationId)?.name || 'Necunoscut';
            const items = group.items || [];
            if (items.length > 0) {
                 console.log(`\n🛑 Locatia [${orgName}] are ${items.length} produse oprite/fara stoc în iiko POS!`);
                 items.forEach(item => {
                      console.log(`   - Produs ID: ${item.productId} (Stoc Rămas: ${item.balance})`);
                      totalStopped++;
                 });
            }
        }
    }
    
    if (totalStopped === 0) {
        console.log(`\n😎 SUPERB: Toate cele ${orgIds.length} restaurante au 100% din meniu ACTIV în iiko în acest moment! Niciun produs nu este marcat ca "sold-out" în casă.`);
    } else {
        console.log(`\n🔥 Total: ${totalStopped} produse oprite la nivel de rețea. Această listă trebuie să se reflecte și pe Glovo/Bolt, altfel riscați comenzi anulate!`);
    }

    // 4. Meniu
    console.log(`\n📖 Descarc instant structura Meniului Central (Categorii/Produse/Preturi) pentru locația ${organizations[0].name}...`);
    const resMenu = await fetch(`${BASE_URL}/nomenclature`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationId: orgIds[0] })
    });
    
    if (resMenu.status === 200) {
        const menuData = await resMenu.json();
        console.log(`✅ GATA! Am descărcat:`);
        console.log(`   🔸 ${menuData.groups?.length || 0} Categorii Principale (ex: Sushi, Rulouri, Băuturi etc.)`);
        console.log(`   🔸 ${menuData.products?.length || 0} Produse cu rețetar și Preț Bază introduse.`);
        console.log(`   🔸 ${menuData.sizes?.length || 0} Mărimi setate.`);
    } else {
        console.log(`Eroare la meniu:`, await resMenu.text());
    }
}

fetchOperationalData().catch(console.error);
