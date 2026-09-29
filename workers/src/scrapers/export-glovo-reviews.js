import { GlovoPartnerScraper } from './glovo-partner-scraper.js';
import fs from 'fs';
import path from 'path';

(async () => {
  const scraper = new GlovoPartnerScraper();
  // Folosim contul existent (email și parolă) – nu contează dacă nu este folosit, cookie‑urile vor face bypass.
  const result = await scraper.scrapeReviews('jeka7ro@gmail.com', '31Martie2026!');
  if (result.success) {
    const outPath = path.resolve('./glovo-reviews.json');
    fs.writeFileSync(outPath, JSON.stringify(result.data, null, 2), 'utf8');
    console.log('✅ Recenzii salvate în', outPath, '(', result.data.length, 'înregistrări)');
  } else {
    console.error('❌ Eroare la extragere:', result.error || result.message);
  }
})();
