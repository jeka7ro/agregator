import fs from 'fs'
const data = JSON.parse(fs.readFileSync('dump.json'))
const missing = data.filter(r => !r.address || r.address.trim() === '')
console.log(missing.slice(0, 15).map(r => r.name))
