import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_KEY);

async function run() {
    const { data: restaurants, error } = await supabase.from('restaurants').select('id, name, glovo_url').not('glovo_url', 'is', null);
    if (error) { console.error(error); return; }

    let sqlStmts = [];
    let count = 0;

    for (const r of restaurants) {
        let url = r.glovo_url.trim();
        
        // Remove trailing slash if exists
        if (url.endsWith('/')) url = url.slice(0, -1);
        
        // Check if it already has /stores/
        if (!url.includes('/stores/')) {
            // e.g. https://glovoapp.com/ro/ro/sibiu/poki-woki-sibiu-sbz
            // split by '/'
            const parts = url.split('/');
            // The last part is the slug (poki-woki-sibiu-sbz)
            // The second to last part is the city (sibiu)
            // Insert 'stores' before the slug
            const slug = parts.pop();
            parts.push('stores');
            parts.push(slug);
            const newUrl = parts.join('/');
            
            sqlStmts.push(`UPDATE restaurants SET glovo_url = '${newUrl}' WHERE id = '${r.id}';`);
            count++;
        }
    }

    fs.writeFileSync('fix_glovo.sql', sqlStmts.join('\n'));
    console.log(`Generated SQL to fix ${count} Glovo URLs!`);
}

run();
