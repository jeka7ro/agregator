import fs from 'fs';
const code = fs.readFileSync('src/scrapers/competitor-scraper.js', 'utf8');
const match = code.match(/const CITY_COORDS = (\{[\s\S]*?\});/);
if (match) console.log(match[1]);
