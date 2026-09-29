import { GlovoChecker } from './src/checkers/glovo-checker.js';

async function test() {
    const checker = new GlovoChecker();
    const fakeRestaurant = {
        name: 'Poki Woki (Sibiu)',
        glovo_url: 'https://glovoapp.com/ro/ro/sibiu/stores/poki-woki-sibiu-sbz'
    };
    
    console.log('Testing Glovo Checker with new URL format...');
    const result = await checker.check(fakeRestaurant);
    console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
