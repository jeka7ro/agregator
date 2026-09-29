import { exec } from 'child_process';
import fetch from 'node-fetch';

(async () => {
  // Verify remote‑debugging endpoint
  let wsEndpoint = null;
  try {
    const resp = await fetch('http://localhost:9222/json/version');
    const data = await resp.json();
    wsEndpoint = data.webSocketDebuggerUrl;
  } catch (e) {
    console.warn('[Auto] Chrome remote‑debugging nu a fost găsit. Pornește Chrome cu `--remote-debugging-port=9222` și păstrează fereastra logată.');
  }

  if (wsEndpoint) {
    console.log('[Auto] Chrome cu remote‑debugging găsit – se va folosi pentru export.');
  }

  console.log('[Auto] Rulăm export‑glovo‑reviews.js...');
  exec('node workers/src/scrapers/export-glovo-reviews.js', (error, stdout, stderr) => {
    if (error) {
      console.error('[Auto] Eroare la export:', error);
    } else {
      console.log(stdout);
      if (stderr) console.error(stderr);
    }
    console.log('[Auto] Done.');
  });
})();
