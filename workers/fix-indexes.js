import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;

const envText = fs.readFileSync('./.env', 'utf-8');
const env = envText.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if(k && v.length) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {});

// Generate connection string from Supabase URL and key? No, Supabase usually provides a connection string.
// Let's see if we have connection string in .env
console.log('PG string present?', !!env.PG_URL || !!env.DATABASE_URL);
