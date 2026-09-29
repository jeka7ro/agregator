import { salesSync } from './src/services/sales-sync.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env.local") });

async function run() {
    console.log("Debug 2 days...");
    
    // override fetch to intercept what's sent
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
        if (url.includes('deliveries/by_delivery_date_and_status')) {
            console.log("FETCH:", url, opts.body);
        }
        return origFetch(url, opts);
    };

    await salesSync.syncSales(2);
    process.exit(0);
}
run();
