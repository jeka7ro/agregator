const auth = async () => {
    try {
        const tokenRes = await fetch('https://api-eu.syrve.live/api/1/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: '124d0880f4b44717b69ee21d45fc2656' })
        });
        const d_t = await tokenRes.json();
        
        if (!tokenRes.ok) {
            console.log("Error:", d_t);
            return;
        }

        const orgsRes = await fetch('https://api-eu.syrve.live/api/1/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + d_t.token },
            body: JSON.stringify({ organizationIds: [], returnAdditionalInfo: true, includeDisabled: false })
        });
        const orgs = await orgsRes.json();
        console.log(`Gasite ${orgs.organizations?.length || 0} organizatii (Smash Me):`);
        
        if (orgs.organizations) {
            orgs.organizations.forEach(o => {
                console.log(`- ${o.name} (ID: ${o.id})`);
            });
        }
    } catch (e) {
        console.error(e);
    }
};
auth();
