import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export const config = {
    supabase: {
        url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_KEY
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN
    },
    monitoring: {
        checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '5')
    }
}
