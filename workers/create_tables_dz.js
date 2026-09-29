import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: './.env'});

const pool = new pg.Pool({ connectionString: process.env.SUPABASE_URL.replace('https://', 'postgres://postgres:PASSWORD@').replace('.supabase.co', '.supabase.co:5432/postgres') }); // Wait I dont know the DB password

