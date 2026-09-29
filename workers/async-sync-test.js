import fs from 'fs';

const path = './src/api-server.js';
let content = fs.readFileSync(path, 'utf8');

const target = "app.post('/api/sync-test-all', async (req, res) => {";
const newCode = `app.post('/api/sync-test-all', async (req, res) => {
    try {
        console.log('[API] Starting Platform Availability Test (Background)...');
        const reportId = \`rep_\${Date.now()}\`;
        
        // Return immediately
        res.json({ success: true, reportId, message: "Test started in background" });

        // Run in background
        (async () => {
            try {
                const { data: restaurants, error } = await supabase.from('restaurants').select('*').eq('is_active', true);
                if (error) return;

                const discrepancies = [];
                let checked = 0;

                for (const restaurant of restaurants) {
                    const platforms = ['glovo', 'wolt', 'bolt'];
                    for (const platform of platforms) {
                        const url = restaurant[\`\${platform}_url\`];
                        if (!url) continue;

                        const checker = getChecker(platform);
                        if (!checker) continue;

                        try {
                            const result = await checker.check(restaurant);
                            if (result && result.final_status) {
                                checked++;
                                if (result.final_status === 'unavailable' || result.final_status === 'closed' || result.final_status === 'error') {
                                    discrepancies.push({
                                        restaurant: restaurant.name,
                                        platform,
                                        type: 'store_closed',
                                        message: \`Status: \${result.final_status.toUpperCase()} \${result.scheduleInfo ? '('+result.scheduleInfo+')' : ''}\`
                                    });
                                }
                                
                                if (result.stats && result.stats.indisponibilCount > 0) {
                                    discrepancies.push({
                                        restaurant: restaurant.name,
                                        platform,
                                        type: 'items_stopped',
                                        message: \`\${result.stats.indisponibilCount} produse marcate indisponibil pe \${platform}.\`
                                    });
                                }
                            }
                        } catch (e) {
                            discrepancies.push({
                                restaurant: restaurant.name,
                                platform,
                                type: 'error',
                                message: \`Eroare la scanare: \${e.message}\`
                            });
                        }
                    }
                }

                const report = {
                    id: reportId,
                    created_at: new Date().toISOString(),
                    restaurants_checked: restaurants.length,
                    platforms_checked: checked,
                    discrepancies: discrepancies
                };

                await supabase.from('sync_reports').insert(report);
                console.log(\`[API] Background test \${reportId} finished.\`);
            } catch (err) {
                console.error("Background sync test failed:", err);
            }
        })();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
})

/*`;
// Replace the old block
const startIdx = content.indexOf(target);
const endIdx = content.indexOf("app.get('/api/sync-reports'", startIdx);
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + newCode + "*/\n" + content.substring(endIdx);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Async sync test patched");
}
