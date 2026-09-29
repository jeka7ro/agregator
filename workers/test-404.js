import fetch from 'node-fetch';
async function test() {
    const res = await fetch('https://glovoapp.com/ro/ro/piatra-neamt/fsdfsdf-fdfdf-dfdfd/', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Includes 'Oh, no!':", text.includes('Oh, no!'));
}
test();
