import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { SalesSync } from '../services/sales-sync.js';

(async () => {
    try {
        console.log("Starting backfill for 130 days...");
        const sync = new SalesSync();
        const res = await sync.syncSales(130);
        console.log("Backfill result:", res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
