import { salesSync } from './src/services/sales-sync.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function run() {
    console.log("Starting manual FULL 180-days backfill...");
    try {
        await salesSync.syncSales(180);
        console.log("SUCCESS. All 180 days fetched.");
    } catch (e) {
        console.error("FAIL:", e);
    }
    process.exit(0);
}
run();
