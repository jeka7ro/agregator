import fs from 'fs'
const data = JSON.parse(fs.readFileSync('dump.json'))
const missing = data.filter(r => !r.address)
console.log(`Total restaurants: ${data.length}`)
console.log(`Missing address: ${missing.length}`)
console.log('Sample missing:', missing.slice(0, 3).map(r => r.name))
