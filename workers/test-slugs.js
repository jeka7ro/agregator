import fetch from 'node-fetch';

async function test(url) {
    const res = await fetch(url);
    console.log(url, res.status);
}

test('https://wolt.com/ro/rou/bucharest/restaurant/we-love-sushi');
test('https://wolt.com/ro/rou/bucharest/restaurant/we-love-sushi-unirii');
test('https://wolt.com/ro/rou/bucharest/restaurant/smash-me');
