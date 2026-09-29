// Run Reputation Scraper to fetch reviews from Glovo (and other platforms) and store them in Supabase
import { ReputationScraper } from './reputation-scraper.js';

(async () => {
  const scraper = new ReputationScraper();
  await scraper.runAllScrapes();
  console.log('✅ Reputation scrape finished');
})();
