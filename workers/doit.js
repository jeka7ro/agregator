import fetch from 'node-fetch';

async function doit() {
    const targets = [
        { name: "IKURA ORADEA", city: "oradea", iiko_restaurant_id: "fba7fb0d-5872-4d7a-a660-fef7b539fa04" },
        { name: "SM ORADEA", city: "oradea", iiko_restaurant_id: "647d6cc7-874e-4f32-84cc-fca2114ac3be" },
        { name: "SM BUC TITAN", city: "bucuresti", iiko_restaurant_id: "bdcce8f6-17b5-4b36-bef8-dd5ae9fcd2e9" },
        { name: "SM CLUJ", city: "cluj-napoca", iiko_restaurant_id: "1722dadd-55a0-4ff9-8f4b-2d7c50ff3411" }
    ];

    for (const restaurant of targets) {
        console.log(`[>>] Facem Auto-Discover pentru ${restaurant.name}...`);
        try {
            const res = await fetch('http://localhost:3001/api/auto-discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurant })
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`[SUCCESS] ${restaurant.name}: `, data);
            } else {
                console.log(`[FAIL] ${restaurant.name} HTTP `, res.status);
            }
        } catch (e) {
            console.log(`[ERR] ${restaurant.name} `, e.message);
        }
    }
    console.log("Terminat totul!");
}

doit();
