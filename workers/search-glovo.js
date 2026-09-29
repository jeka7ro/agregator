import fetch from 'node-fetch';
async function test() {
    const res = await fetch('https://api.glovoapp.com/v3/locations/search?query=Roll%20Master&cityCode=PIA', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
        console.log(await res.json());
    } else {
        console.log("Status:", res.status);
    }
}
test();
